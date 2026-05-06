
import React, { useState, useEffect, useRef } from "react";
import { Send, Smartphone, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useBusiness } from "@/contexts/BusinessContext";
import { Service, Professional } from "@/types";
import { AIAgentService } from "@/services/aiAgentService";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Message {
  id: string;
  text: string;
  sender: 'client' | 'ai';
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
}

const WhatsAppSimulator = () => {
  const { business } = useBusiness();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou seu assistente de IA. Como posso ajudar com seu agendamento?',
      sender: 'ai',
      timestamp: new Date(),
      status: 'read'
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [aiService, setAiService] = useState<AIAgentService | null>(null);

  const [contextData, setContextData] = useState<{services: Service[], professionals: Professional[]}>({ services: [], professionals: [] });

  useEffect(() => {
    // Initialize AI Service
    if (process.env.GEMINI_API_KEY) {
      setAiService(new AIAgentService());
    }

    if (business) {
      // Fetch services and professionals for context
      const fetchData = async () => {
        try {
           const servQ = query(collection(db, "services"), where("business_id", "==", business.id));
           const profQ = query(collection(db, "professionals"), where("business_id", "==", business.id));
           const [servSnap, profSnap] = await Promise.all([getDocs(servQ), getDocs(profQ)]);
           setContextData({
             services: servSnap.docs.map(d => ({id: d.id, ...d.data()} as Service)),
             professionals: profSnap.docs.map(d => ({id: d.id, ...d.data()} as Professional))
           });
        } catch (e) {
           console.error("Error fetching context for AI:", e);
        }
      };
      fetchData();
    }
  }, [business]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'client',
      timestamp: new Date(),
      status: 'sent'
    };

    setMessages([...messages, newMsg]);
    setInputValue("");
    processAIResponse([...messages, newMsg]);
  };

  const processAIResponse = async (currentMessages: Message[]) => {
    setIsTyping(true);
    
    if (!aiService || !business) {
       // Mock fallback
       setTimeout(() => {
         let response = "Olá! (A integração IA requer GEMINI_API_KEY). Pode me dizer que horas gostaria para simularmos?";
         if (currentMessages[currentMessages.length - 1].text.toLowerCase().includes("horário")) {
            response = "Claro! Tenho horários às 09:30 e 14:00. Qual prefere?";
         }
         setMessages(prev => [...prev, {
           id: Date.now().toString(),
           text: response,
           sender: 'ai',
           timestamp: new Date()
         }]);
         setIsTyping(false);
       }, 1500);
       return;
    }

    try {
      // Assemble history for Gemini API
      const history = currentMessages.map(msg => ({
        role: msg.sender === 'ai' ? 'model' as const : 'user' as const,
        parts: [{ text: msg.text }]
      }));

      const response = await aiService.runConversation(
        history, 
        business, 
        contextData.services, 
        contextData.professionals
      );

      // Check if function call occurred
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        if (fc.name === "checkAvailability") {
          const availabilityResult = await aiService.executeCheckAvailability(
             fc.args, 
             business, 
             contextData.services, 
             contextData.professionals
          );
          
          // Reply with the function result
          const historyWithFunc = [
            ...history,
            { role: 'model' as const, parts: [{ functionCall: fc }] },
            { role: 'user' as const, parts: [{ functionResponse: { name: fc.name, response: availabilityResult } }] }
          ];

          const followUp = await aiService.runConversation(historyWithFunc, business, contextData.services, contextData.professionals);
          setMessages(prev => [...prev, {
             id: Date.now().toString(),
             text: followUp.text || "Verifiquei os horários.",
             sender: 'ai',
             timestamp: new Date()
          }]);
        }
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: response.text || "...",
          sender: 'ai',
          timestamp: new Date()
        }]);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "Desculpe, tive um problema ao processar sua mensagem.",
        sender: 'ai',
        timestamp: new Date()
      }]);
    }

    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-[500px] w-full max-w-md mx-auto bg-zinc-950 rounded-[2.5rem] border-[8px] border-zinc-800 shadow-2xl relative overflow-hidden">
      {/* Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-zinc-800 rounded-b-2xl z-20 flex items-center justify-center">
         <div className="w-12 h-1 bg-zinc-900 rounded-full" />
      </div>

      {/* Header */}
      <div className="bg-[#075e54] p-4 pt-8 text-white flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm leading-tight">Flowza AI Assistant</h4>
          <p className="text-[10px] opacity-70 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> online
          </p>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#e5ddd5]" 
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain' }}
        ref={scrollRef}
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
          >
            <div className={`max-w-[85%] p-2 rounded-lg shadow-sm text-xs relative ${msg.sender === 'client' ? 'bg-[#dcf8c6] text-black rounded-tr-none' : 'bg-white text-black rounded-tl-none'}`}>
              {msg.text}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[8px] opacity-40">{format(msg.timestamp, 'HH:mm')}</span>
                {msg.sender === 'client' && <CheckCheck className="w-3 h-3 text-blue-500" />}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-2 rounded-lg rounded-tl-none shadow-sm flex gap-1">
              <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#f0f0f0] flex items-center gap-2">
        <Input 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Mensagem"
          className="rounded-full bg-white border-none h-10 text-xs text-black focus-visible:ring-1 focus-visible:ring-primary"
        />
        <Button onClick={handleSend} size="icon" className="shrink-0 w-10 h-10 rounded-full bg-[#075e54] hover:bg-[#128c7e]">
          <Send className="w-4 h-4 text-white" />
        </Button>
      </div>

      {/* Footer / Home Bar */}
      <div className="bg-[#f0f0f0] h-6 flex justify-center items-end pb-2">
         <div className="w-1/3 h-1 bg-zinc-300 rounded-full" />
      </div>

      {/* Overlay Badge */}
      <div className="absolute top-20 right-4 z-10 scale-90">
         <Badge variant="premium" className="shadow-lg border-white/20 py-1">
            <Sparkles className="w-3 h-3 mr-1" /> IA Ativa
         </Badge>
      </div>
    </div>
  );
};

export default WhatsAppSimulator;
