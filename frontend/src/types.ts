export type AreaUnit = 'acres' | 'kanal'
export type TaskStatus = 'pending' | 'completed' | 'skipped' | 'postponed'

export interface User {
  id: number
  name: string
  email: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: User
}

export interface AuthInput {
  name?: string
  email: string
  password: string
}

export interface Field {
  id: number
  name: string
  area: number
  area_unit: AreaUnit
  location: string | null
  created_at: string
}

export interface FarmTask {
  id: number
  title: string
  category: string
  due_date: string
  status: TaskStatus
}

export interface CropCycle {
  id: number
  crop: string
  sowing_date: string
  schedule_source: string
  schedule_version: string
  created_at: string
  field: Field
  tasks: FarmTask[]
}

export interface CropCycleInput {
  field_name: string
  area: number
  area_unit: AreaUnit
  location: string
  sowing_date: string
}
