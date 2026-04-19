// Tipos para integração com HITS PMS
// Documentação: https://api.hitspms.net/swagger/index.html

export interface HitsAvailabilityParams {
  checkIn: string     // YYYY-MM-DD
  checkOut: string    // YYYY-MM-DD
  guests?: number
  roomTypeId?: number // ID do tipo de quarto (opcional)
}

// Tipo interno normalizado (após mapeamento da resposta HITS)
export interface HitsRoom {
  id: string
  code: string
  name: string
  type: string
  maxGuests: number
  available: boolean
  rate: number
  currency: string
  amenities?: string[]
  description?: string
}

export interface HitsRate {
  roomType: string
  roomName: string
  checkIn: string
  checkOut: string
  nights: number
  ratePerNight: number
  totalRate: number
  currency: string
  mealPlan?: string
  rateCode?: string
}

export interface HitsRoomType {
  code: string
  name: string
  description: string
  maxGuests: number
  bedType?: string
  amenities?: string[]
}

export interface HitsReservationInput {
  guestName: string
  guestPhone: string
  guestEmail?: string
  checkIn: string
  checkOut: string
  roomType: string
  guests: number
  rateCode?: string
  specialRequests?: string
}

export interface HitsReservation {
  id: string
  confirmationNumber: string
  status: string
  guestName: string
  checkIn: string
  checkOut: string
  roomType: string
  totalRate: number
  currency: string
}
