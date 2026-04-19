import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/**
 * Transcreve um áudio a partir de uma URL usando OpenAI Whisper.
 * Faz download do áudio e envia para a API.
 */
export async function transcribeAudio(audioUrl: string): Promise<string> {
  // Fazer download do áudio
  const audioResponse = await fetch(audioUrl)
  if (!audioResponse.ok) {
    throw new Error(`Falha ao baixar áudio: ${audioResponse.status}`)
  }

  const audioBuffer = await audioResponse.arrayBuffer()
  const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' })

  // Criar File object para a API OpenAI
  const audioFile = new File([audioBlob], 'audio.ogg', { type: 'audio/ogg' })

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'pt',
    response_format: 'text',
  })

  return String(transcription).trim()
}
