// Shared TypeScript types for booking domain
// ⚠️  TYPE ERROR ON LINE 42 — causes tsc compilation failure

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED';
export type BookingType = 'FLIGHT' | 'HOTEL' | 'PACKAGE';

export interface Booking {
  id: number;
  bookingRef: string;
  tenantId: string;
  passengerId: string;
  route: string;
  amount: number;
  status: BookingStatus;
  bookingType: BookingType;
  createdAt: Date;
  updatedAt: Date;
  isDuplicate: boolean;
}

export interface CreateBookingDto {
  bookingRef: string;
  tenantId: string;
  passengerId: string;
  route: string;
  amount: number;
  bookingType: BookingType;
}

export interface BookingResponse {
  data: Booking;
  meta?: BookingMeta;
}

export interface BookingMeta {
  // TODO: Add pagination meta (SCLT-002)
  total?: number;
  page?: number;
  limit?: number;
}

// LINE 42 — TypeScript error: 'string | undefined' not assignable to 'string'
// This happens because tenantId is read from query params which may be undefined
export interface BookingQueryParams {
  tenantId: string;       // ← ERROR: should be 'string | undefined'
  status?: BookingStatus;
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
}

// TODO: Add Zod validation schema for CreateBookingDto (SCLT-001)
// import { z } from 'zod';
// export const CreateBookingSchema = z.object({ ... });
