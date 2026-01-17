import {
    Folder, Briefcase, Home, User, Star, Settings, Heart, Globe,
    Music, Video, Book, Phone, Mail, ShoppingCart, Coffee,
    Zap, Anchor, Gift, Image, MapPin, Grid, List, Layout,
    CheckSquare, Flag, Target, Smile, Cloud, Camera, Code
} from "lucide-react"

export const PROJECT_ICONS = {
    Folder,
    Briefcase,
    Home,
    User,
    Star,
    Settings,
    Heart,
    Globe,
    Music,
    Video,
    Book,
    Phone,
    Mail,
    ShoppingCart,
    Coffee,
    Zap,
    Anchor,
    Gift,
    Image,
    MapPin,
    Grid,
    List,
    Layout,
    CheckSquare,
    Flag,
    Target,
    Smile,
    Cloud,
    Camera,
    Code
} as const

export type ProjectIconName = keyof typeof PROJECT_ICONS

export function getProjectIcon(name: string | null) {
    if (!name || !(name in PROJECT_ICONS)) return Folder
    return PROJECT_ICONS[name as ProjectIconName]
}
