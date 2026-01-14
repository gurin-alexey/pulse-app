import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import { RRule, Frequency } from 'rrule'
import { Check, ChevronRight, Repeat } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'

type RecurrenceMenuProps = {
    selectedDate: Date | null
    value: string | null
    onChange: (rrule: string | null) => void
    children: React.ReactNode
}

export function RecurrenceMenu({ selectedDate, value, onChange, children }: RecurrenceMenuProps) {
    // Helper to generate RRule strings
    // We strive to match the requested format:
    // "Weekly on Monday", "Monthly on the 5th", "Annually on Jan 5"

    const baseDate = selectedDate || new Date()
    const currentDayName = format(baseDate, 'EEE') // e.g., "Mon"
    const currentDayNum = baseDate.getDate()
    const currentMonthName = format(baseDate, 'MMM') // e.g., "Jan"

    // Map weekday string to RRule.MO, RRule.TU, etc. if needed, 
    // but for simple construction we can just rely on the standard frequency if we don't need complex byweekday logic yet,
    // OR simply construct the string manually which is often easier for simple presets.

    // 1. Daily
    const dailyRule = new RRule({ freq: RRule.DAILY }).toString()

    // 2. Weekly
    // RRule.js uses ByWeekday for this.
    // Let's dynamic match the day of the week of the selected date.
    // RRule weekday map: 0->MO, 1->TU, ... 6->SU
    // JS GetDay: 0->Sun, 1->Mon...
    const jsDay = baseDate.getDay()
    const rruleDay = jsDay === 0 ? RRule.SU : jsDay === 1 ? RRule.MO : jsDay === 2 ? RRule.TU : jsDay === 3 ? RRule.WE : jsDay === 4 ? RRule.TH : jsDay === 5 ? RRule.FR : RRule.SA

    const weeklyRule = new RRule({
        freq: RRule.WEEKLY,
        byweekday: [rruleDay]
    }).toString()

    // 3. Monthly
    const monthlyRule = new RRule({
        freq: RRule.MONTHLY,
        bymonthday: currentDayNum
    }).toString()

    // 4. Yearly
    const yearlyRule = new RRule({
        freq: RRule.YEARLY,
        bymonth: baseDate.getMonth() + 1, // RRule uses 1-12
        bymonthday: currentDayNum
    }).toString()

    // 5. Weekdays (Mon-Fri)
    const weekdaysRule = new RRule({
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR]
    }).toString()

    const options = [
        { label: 'Daily', rule: dailyRule },
        { label: `Weekly (${currentDayName})`, rule: weeklyRule },
        { label: `Monthly (${currentDayNum})`, rule: monthlyRule },
        { label: `Annually (${currentDayNum} ${currentMonthName})`, rule: yearlyRule },
        { label: 'Every Weekday (Mon-Fri)', rule: weekdaysRule },
    ]

    const getHumanLabel = (ruleStr: string | null) => {
        if (!ruleStr) return 'Do not repeat'
        // Simple fuzzy match for our presets
        const found = options.find(o => o.rule === ruleStr) // Note: RRule.toString() might include start date context? 
        // RRule generic toString() usually starts with "RRULE:..." or just the content.
        // It's safer to compare significant parts or parse it back. 
        // For this MVP let's just use exact match or "Custom".

        // Actually, RRule.toString() usually omits DTSTART unless specified.
        // Let's assume exact match works for these simple generated ones.
        return found ? found.label : 'Custom'
    }

    return (
        <Menu as="div" className="relative w-full">
            <MenuButton className="w-full text-left outline-none">
                {children}
            </MenuButton>

            <MenuItems
                anchor="bottom start"
                className="w-56 bg-white rounded-xl shadow-lg border border-gray-100 p-1 focus:outline-none z-[200] origin-top-left text-sm"
            >
                <MenuItem>
                    {({ active }: { active: boolean }) => (
                        <button
                            onClick={() => onChange(null)}
                            className={clsx(
                                "flex w-full items-center justify-between px-3 py-2 rounded-lg transition-colors",
                                active ? "bg-gray-100 text-gray-900" : "text-gray-700",
                                !value && "font-medium text-blue-600 bg-blue-50"
                            )}
                        >
                            <span>Do not repeat</span>
                            {!value && <Check size={16} className="text-blue-600" />}
                        </button>
                    )}
                </MenuItem>

                <div className="my-1 border-t border-gray-100" />

                {options.map((option) => (
                    <MenuItem key={option.label}>
                        {({ active }: { active: boolean }) => (
                            <button
                                onClick={() => onChange(option.rule)}
                                className={clsx(
                                    "flex w-full items-center justify-between px-3 py-2 rounded-lg transition-colors",
                                    active ? "bg-gray-100 text-gray-900" : "text-gray-700",
                                    value === option.rule && "font-medium text-blue-600 bg-blue-50"
                                )}
                            >
                                <span>{option.label}</span>
                                {value === option.rule && <Check size={16} className="text-blue-600" />}
                            </button>
                        )}
                    </MenuItem>
                ))}

                <div className="my-1 border-t border-gray-100" />

                <MenuItem>
                    {({ active }: { active: boolean }) => (
                        <button
                            onClick={() => {
                                // TODO: Implement custom recurrence dialog
                                alert("Custom recurrence not implemented yet")
                            }}
                            className={clsx(
                                "flex w-full items-center justify-between px-3 py-2 rounded-lg transition-colors group",
                                active ? "bg-gray-100 text-gray-900" : "text-gray-700"
                            )}
                        >
                            <span>Custom...</span>
                            <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600" />
                        </button>
                    )}
                </MenuItem>
            </MenuItems>
        </Menu>
    )
}
