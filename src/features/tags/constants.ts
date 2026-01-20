import { MapPin, Zap, Clock, Users } from 'lucide-react'

export type CategoryType = 'place' | 'energy' | 'time' | 'people'

export const CATEGORIES: { id: CategoryType; label: string; icon: any; color: string }[] = [
    { id: 'place', label: 'Место', icon: MapPin, color: 'text-red-500' },
    { id: 'energy', label: 'Энергия', icon: Zap, color: 'text-yellow-500' },
    { id: 'time', label: 'Время', icon: Clock, color: 'text-blue-500' },
    { id: 'people', label: 'Люди', icon: Users, color: 'text-purple-500' },
]
