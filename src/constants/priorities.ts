export type PriorityLevel = 'high' | 'medium' | 'low' | 'none';

export interface PriorityConfig {
    id: PriorityLevel;
    label: string;
    value: string | null; // For DB updates (null for normal)
    colors: {
        text: string;
        bg: string;
        ring: string; // For selected state rings
        dot: string; // For small indicators
        hover: string;
        fill?: string; // For icon fill
    };
}

export const PRIORITIES: PriorityConfig[] = [
    {
        id: 'high',
        label: 'High',
        value: 'high',
        colors: {
            text: 'text-red-500',
            bg: 'bg-red-500', // For solid indicators
            ring: 'ring-red-200',
            dot: 'bg-red-400',
            hover: 'hover:bg-red-50',
            fill: 'fill-current'
        }
    },
    {
        id: 'medium',
        label: 'Medium',
        value: 'medium',
        colors: {
            text: 'text-amber-500',
            bg: 'bg-amber-500',
            ring: 'ring-amber-200',
            dot: 'bg-orange-400', // Matching existing orange/amber mix
            hover: 'hover:bg-amber-50',
            fill: 'fill-current'
        }
    },
    {
        id: 'low',
        label: 'Low',
        value: 'low',
        colors: {
            text: 'text-blue-500',
            bg: 'bg-blue-500',
            ring: 'ring-blue-200',
            dot: 'bg-blue-400',
            hover: 'hover:bg-blue-50',
            fill: 'fill-current'
        }
    },
    {
        id: 'none',
        label: 'Normal',
        value: null,
        colors: {
            text: 'text-gray-400',
            bg: 'bg-gray-400',
            ring: 'ring-gray-200',
            dot: 'bg-blue-400', // Keeping consistent with "default" task color often being blueish or keeping neutral
            hover: 'hover:bg-gray-50'
        }
    }
];

export const getPriorityConfig = (priority: string | null | undefined): PriorityConfig => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES.find(p => p.id === 'none')!;
};
