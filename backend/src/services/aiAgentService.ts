import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { format } from "date-fns";
import { collection, query, where, getDocsFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Business, Service, Professional, Appointment } from "@shared/types";
import { AISchedulingService } from "./aiSchedulingService";

export class AIAgentService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // Define tools for the model
  private getCheckAvailabilityTool(): FunctionDeclaration {
    return {
      name: "checkAvailability",
      description: "Search for available appointment slots for a specific date, service, and professional.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
          serviceId: { type: Type.STRING, description: "The ID of the service the user wants to book" },
          professionalId: { type: Type.STRING, description: "The ID of the professional" },
        },
        required: ["date", "serviceId", "professionalId"],
      },
    };
  }

  // A method to execute the tool locally based on the function call
  async executeCheckAvailability(args: any, business: Business, services: Service[], professionals: Professional[]) {
    try {
      const { date, serviceId, professionalId } = args;
      const service = services.find(s => s.id === serviceId);
      const prof = professionals.find(p => p.id === professionalId);

      if (!service) return { error: "Serviço não encontrado." };
      if (!prof) return { error: "Profissional não encontrado." };

      const q = query(
        collection(db, "appointments"),
        where("business_id", "==", business.id),
        where("professional_id", "==", prof.id),
        where("appointment_date", "==", date),
        where("status", "!=", "cancelled")
      );
      
      const snap = await getDocsFromServer(q);
      const dayAppointments = snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));

      const workingHours = prof.working_hours || { start: '08:00', end: '18:00' };
      const duration = Number(service.duration || service.duration_minutes || 30);
      const buffer = Number(prof.buffer_minutes || 0);
      const targetDate = new Date(date + "T00:00:00");

      const availableSlots = AISchedulingService.generateAvailableSlots(
        workingHours,
        duration,
        dayAppointments,
        30,
        buffer,
        prof.breaks,
        targetDate.getDay()
      );

      if (availableSlots.length === 0) {
        return { available: false, message: "Não há horários disponíveis neste dia." };
      }

      return { available: true, slots: availableSlots };
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async runConversation(
    history: { role: 'user' | 'model'; parts: { text?: string, functionCall?: any, functionResponse?: any }[] }[],
    business: Business,
    services: Service[],
    professionals: Professional[]
  ) {
    const servicesText = services.map(s => s.name + " (R$" + s.price + ", id: " + s.id + ")").join(', ');
    const profsText = professionals.map(p => p.name + " (id: " + p.id + ")").join(', ');

    const systemInstruction = `Você é o assistente virtual do estabelecimento "${business.name}".
    Sua missão é ajudar os clientes a agendar horários, tirar dúvidas sobre serviços e profissionais.
    
    Regras:
    1. Seja educado, amigável e conciso (mensagens curtas tipo WhatsApp).
    2. Liste os serviços disponíveis se perguntado. Serviços atuais: ${servicesText}.
    3. Liste os profissionais disponíveis. Profissionais atuais: ${profsText}.
    4. Ao tentar agendar, sempre chame a função checkAvailability com a data (YYYY-MM-DD), o ID do serviço e o ID do profissional.
    5. Se o cliente informar dados incompletos (como faltar o profissional ou a data), pergunte o que falta antes de buscar disponibilidade.
    6. Hoje é ${format(new Date(), "yyyy-MM-dd")}.
    7. Após mostrar disponibilidade, peça o nome completo e telefone para simular a conclusão.`;

    const chat = this.ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
        temperature: 0.1,
        tools: [{ functionDeclarations: [this.getCheckAvailabilityTool()] }]
      }
    });

    // Playback history
    for (const msg of history.slice(0, -1)) { // skip last as we send it
       if (msg.role === 'user') {
          // just standard string
          const textPart = msg.parts.find((p: any) => p.text)?.text || '';
          await chat.sendMessage({ message: textPart });
       }
       // Note: complex history playback with function outputs would require full structure, 
       // but for simplicity we assume the caller is just sending the next message and we manage internal chat if using create()
       // Actually, we should just send the array using generateContent.
    }

    // A better approach for multi-turn with function calls using generateContent
    const targetHistory = history.map(h => ({
      role: h.role,
      parts: h.parts
    }));

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: targetHistory,
      config: {
        systemInstruction,
        temperature: 0.1,
        tools: [{ functionDeclarations: [this.getCheckAvailabilityTool()] }]
      }
    });

    return response;
  }
}
