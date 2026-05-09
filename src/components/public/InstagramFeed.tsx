import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { InstagramService } from '@/services/instagramService';
import { Instagram, ExternalLink, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface InstagramFeedProps {
  businessId: string;
  businessName: string;
}

const InstagramFeed: React.FC<InstagramFeedProps> = ({ businessId, businessName }) => {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['instagram_posts', businessId],
    queryFn: () => InstagramService.getCachedPosts(businessId),
    enabled: !!businessId
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="aspect-square bg-muted rounded-xl"></div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 rounded-lg text-white">
            <Instagram className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-none">Feed do Instagram</h3>
            <p className="text-sm text-muted-foreground">Acompanhe as novidades da {businessName}</p>
          </div>
        </div>
        <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
          Ver Perfil <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {posts.map((post, idx) => (
          <motion.a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
          >
            {post.media_type === 'VIDEO' ? (
              <video 
                src={post.media_url} 
                className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0 group-hover:scale-110"
                muted
                loop
                onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
              />
            ) : post.media_url ? (
              <img 
                src={post.media_url} 
                alt={post.caption || 'Instagram Post'} 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/10 grayscale transition-all group-hover:grayscale-0 group-hover:scale-110">
                <Instagram className="w-8 h-8 opacity-40" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Instagram className="w-8 h-8 text-white scale-75 group-hover:scale-100 transition-transform" />
            </div>
            {post.caption && (
               <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-[10px] text-white line-clamp-1">{post.caption}</p>
               </div>
            )}
          </motion.a>
        ))}
      </div>
    </div>
  );
};

export default InstagramFeed;
