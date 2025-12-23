

import { GoogleGenAI } from "@google/genai";
import { AppState } from "../types";

// Helper to get AI instance safely
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export const chatWithInventoryAI = async (
  userMessage: string,
  appState: AppState
): Promise<string> => {
  try {
    const ai = getAIClient();
    
    // Prepare context from app state
    const inventoryContext = JSON.stringify(appState.inventory.map(i => ({
      name: i.name,
      total: i.totalQuantity,
      available: i.availableQuantity,
      inUse: i.inUseQuantity,
      maintenance: i.maintenanceQuantity,
      location: i.location
    })));

    const eventContext = JSON.stringify(appState.events.filter(e => e.status !== 'COMPLETED' && e.status !== 'CANCELLED').map(e => ({
      name: e.name,
      location: e.location,
      status: e.status,
      items: e.items.map(i => {
        const itemDetails = appState.inventory.find(inv => inv.id === i.itemId);
        return `${itemDetails?.name} (Qty: ${i.quantity})`;
      })
    })));

    const systemPrompt = `
      Bạn là trợ lý ảo thông minh cho phần mềm quản lý kho sự kiện (EventStock AI).
      
      Dữ liệu kho hàng hiện tại (JSON): ${inventoryContext}
      Dữ liệu sự kiện đang diễn ra/sắp tới (JSON): ${eventContext}
      
      Nhiệm vụ của bạn:
      1. Trả lời các câu hỏi về số lượng hàng hóa, vị trí hàng hóa.
      2. Cho biết hàng hóa đang được sử dụng ở sự kiện nào.
      3. Cảnh báo nếu người dùng hỏi mượn thiết bị mà số lượng tồn kho không đủ.
      4. Sử dụng ngôn ngữ tiếng Việt tự nhiên, chuyên nghiệp.
      5. Nếu được hỏi về một thiết bị không có trong danh sách, hãy nói rõ là kho không có.
      
      Hãy trả lời ngắn gọn, súc tích.
    `;

    // Fixed: Updated to 'gemini-3-flash-preview' for text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      // FIX: Although a string is supported, wrapping the user message in the standard `Content` structure is more explicit and robust.
      contents: { parts: [{ text: userMessage }] },
      config: {
        systemInstruction: systemPrompt,
      }
    });

    // Fixed: Access text as a property, not a method
    return response.text || "Xin lỗi, tôi không thể phân tích dữ liệu lúc này.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Đã có lỗi xảy ra khi kết nối với AI. Vui lòng kiểm tra API Key.";
  }
};