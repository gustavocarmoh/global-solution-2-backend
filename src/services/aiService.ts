import OpenAI from 'openai';

const defaultSuggestions = [
  'Posso reservar automaticamente se voce informar data, sala e horario.',
  'Atualize sua disponibilidade em /profile/me para receber sugestoes mais precisas.'
];

const openAiKey = process.env.OPENAI_API_KEY;
const openAiModel = process.env.OPENAI_MODEL ?? 'gpt-3.5-turbo';
const openai = openAiKey ? new OpenAI({ apiKey: openAiKey }) : null;

function buildFallbackResponse(message: string, availability: Record<string, string[]> | null = null): string {
  const normalized = message?.toLowerCase() ?? '';
  let response = 'Aqui e o assistente virtual. ';

  if (normalized.includes('dispon')) {
    response += 'Lembre-se de registrar os horarios disponiveis por dia da semana na aba de perfil. ';
  }

  if (normalized.includes('suporte') || normalized.includes('problema')) {
    response += 'Caso seja algo urgente, tambem avise o suporte humano pelo endpoint /chat/support. ';
  }

  if (normalized.includes('sala') || normalized.includes('room')) {
    response += 'Confira se a sala desejada ja esta ocupada antes de enviar a reserva. ';
  }

  if (availability && typeof availability === 'object') {
    const daysWithAvailability = Object.entries(availability)
      .filter(([, slots]) => Array.isArray(slots) && slots.length > 0)
      .map(([day]) => day)
      .join(', ');

    if (daysWithAvailability) {
      response += `Percebi disponibilidade registrada para: ${daysWithAvailability}. Use esses slots como prioridade. `;
    }
  }

  response += defaultSuggestions[Math.floor(Math.random() * defaultSuggestions.length)];

  return response.trim();
}

export async function generateAiResponse(
  message: string,
  availability: Record<string, string[]> | null = null
): Promise<string> {
  if (openai) {
    try {
      const availabilityText = availability ? JSON.stringify(availability) : 'Nao informada';
      const completion = await openai.chat.completions.create({
        model: openAiModel,
        messages: [
          {
            role: 'system',
            content: 'Voce e um assistente especializado em agendamento de salas de reuniao. Responda de forma curta e pragmatica.'
          },
          {
            role: 'user',
            content: `Mensagem: ${message}\nDisponibilidade do usuario: ${availabilityText}`
          }
        ],
        temperature: 0.4
      });

      const response = completion.choices[0]?.message?.content?.trim();

      if (response) {
        return response;
      }
    } catch (error) {
      console.error('Erro ao chamar o provedor de IA:', error);
    }
  }

  return buildFallbackResponse(message, availability);
}
