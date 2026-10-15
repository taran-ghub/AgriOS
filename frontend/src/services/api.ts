import type {
  AuthInput,
  AuthResponse,
  CropCycle,
  CropCycleInput,
  FarmTask,
  TaskStatus,
  User,
} from '../types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'agrios.accessToken'

export function hasStoredSession(): boolean {
  return Boolean(window.localStorage.getItem(TOKEN_KEY))
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = window.localStorage.getItem(TOKEN_KEY)

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    let message = 'AgriOS could not complete that request.'

    if (typeof body?.detail === 'string') {
      message = body.detail
    } else if (Array.isArray(body?.detail)) {
      message = body.detail
        .map((error: { loc?: (string | number)[]; msg?: string }) => {
          const field = error.loc
            ?.filter((part) => part !== 'body')
            .join('.')

          return field
            ? `${field}: ${error.msg ?? 'Invalid value'}`
            : error.msg ?? 'Invalid value'
        })
        .join('; ')
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function authenticate(
  path: string,
  payload: AuthInput,
): Promise<AuthResponse> {
  const response = await request<AuthResponse>(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  window.localStorage.setItem(TOKEN_KEY, response.access_token)
  return response
}

export function registerAccount(
  payload: AuthInput,
): Promise<AuthResponse> {
  return authenticate('/api/auth/register', payload)
}

export function loginAccount(
  payload: AuthInput,
): Promise<AuthResponse> {
  return authenticate('/api/auth/login', payload)
}

export function getCurrentUser(): Promise<User> {
  return request('/api/auth/me')
}

export async function logoutAccount(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } finally {
    clearStoredSession()
  }
}

export function createCropCycle(
  payload: CropCycleInput,
): Promise<CropCycle> {
  return request('/api/crop-cycles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listCropCycles(): Promise<CropCycle[]> {
  return request('/api/crop-cycles')
}

export function getCropCycle(id: number): Promise<CropCycle> {
  return request(`/api/crop-cycles/${id}`)
}

export function updateFarmTask(
  id: number,
  changes: { status?: TaskStatus; due_date?: string },
): Promise<FarmTask> {
  return request(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}