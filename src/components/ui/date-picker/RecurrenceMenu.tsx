import { Menu, MenuButton, MenuItems, MenuItem, Dialog, Transition } from '@headlessui/react'
import { RRule } from 'rrule'
import { Check, ChevronRight, Repeat } from 'lucide-react'
import clsx from 'clsx'
import { format, endOfMonth } from 'date-fns'
import { Fragment, useEffect, useMemo, useState } from 'react'

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

    const weekdayOptions = [
        { label: 'Mon', value: 'MO', rrule: RRule.MO },
        { label: 'Tue', value: 'TU', rrule: RRule.TU },
        { label: 'Wed', value: 'WE', rrule: RRule.WE },
        { label: 'Thu', value: 'TH', rrule: RRule.TH },
        { label: 'Fri', value: 'FR', rrule: RRule.FR },
        { label: 'Sat', value: 'SA', rrule: RRule.SA },
        { label: 'Sun', value: 'SU', rrule: RRule.SU },
    ]

    const defaultOrdinal = useMemo(() => {
        const monthEnd = endOfMonth(baseDate)
        const isLastWeek = baseDate.getDate() + 7 > monthEnd.getDate()
        if (isLastWeek) return -1
        return Math.ceil(baseDate.getDate() / 7)
    }, [baseDate])

    const defaultWeekday = useMemo(() => {
        const jsDay = baseDate.getDay()
        return jsDay === 0 ? 'SU' : jsDay === 1 ? 'MO' : jsDay === 2 ? 'TU' : jsDay === 3 ? 'WE' : jsDay === 4 ? 'TH' : jsDay === 5 ? 'FR' : 'SA'
    }, [baseDate])

    const [isCustomOpen, setIsCustomOpen] = useState(false)
    const [customInterval, setCustomInterval] = useState(1)
    const [customOrdinal, setCustomOrdinal] = useState<number>(defaultOrdinal)
    const [customWeekday, setCustomWeekday] = useState<string>(defaultWeekday)
    const [customPreset, setCustomPreset] = useState<'weekday' | 'day'>('day')

    useEffect(() => {
        if (!value) return
        try {
            const rr = RRule.fromString(value)
            if (rr.options.freq === RRule.MONTHLY && rr.options.byweekday?.length === 1) {
                const by = rr.options.byweekday[0] as any
                if (by?.weekday !== undefined && by?.n !== undefined) {
                    const option = weekdayOptions.find(w => w.rrule.weekday === by.weekday)
                    if (option) setCustomWeekday(option.value)
                    setCustomOrdinal(by.n)
                    setCustomInterval(rr.options.interval || 1)
                    setCustomPreset('day')
                }
            } else if (rr.options.freq === RRule.MONTHLY && rr.options.byweekday?.length === 5 && rr.options.bysetpos?.length === 1) {
                const weekdays = rr.options.byweekday as any[]
                const isWeekdaySet =
                    weekdays.some(w => w.weekday === RRule.MO.weekday) &&
                    weekdays.some(w => w.weekday === RRule.TU.weekday) &&
                    weekdays.some(w => w.weekday === RRule.WE.weekday) &&
                    weekdays.some(w => w.weekday === RRule.TH.weekday) &&
                    weekdays.some(w => w.weekday === RRule.FR.weekday)
                if (isWeekdaySet) {
                    setCustomPreset('weekday')
                    setCustomInterval(rr.options.interval || 1)
                }
            }
        } catch {
            // ignore parse errors
        }
    }, [value])

    const buildCustomMonthlyRule = () => {
        if (customPreset === 'weekday') {
            return new RRule({
                freq: RRule.MONTHLY,
                interval: customInterval,
                byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
                bysetpos: 1
            }).toString()
        }

        const weekday = weekdayOptions.find(w => w.value === customWeekday)?.rrule || RRule.MO
        const byweekday = [weekday.nth(customOrdinal)]
        return new RRule({
            freq: RRule.MONTHLY,
            interval: customInterval,
            byweekday
        }).toString()
    }

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
                                setIsCustomOpen(true)
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

            <Transition appear show={isCustomOpen} as={Fragment}>
                <Dialog as="div" className="relative z-[300]" onClose={() => setIsCustomOpen(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-200"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-200"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-150"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all text-sm">
                                    <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                                        Custom monthly recurrence
                                    </Dialog.Title>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Examples: every 2nd Tuesday or 1st Monday of the month.
                                    </p>

                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-24 text-gray-500">Preset</span>
                                            <select
                                                value={customPreset}
                                                onChange={(e) => setCustomPreset(e.target.value as 'weekday' | 'day')}
                                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="day">Nth weekday</option>
                                                <option value="weekday">First working day</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="w-24 text-gray-500">Every</span>
                                            <select
                                                value={customInterval}
                                                onChange={(e) => setCustomInterval(Number(e.target.value))}
                                                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                {[1, 2, 3, 4, 6, 12].map(n => (
                                                    <option key={n} value={n}>{n} month{n > 1 ? 's' : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {customPreset === 'day' && (
                                            <div className="flex items-center gap-3">
                                                <span className="w-24 text-gray-500">On the</span>
                                                <select
                                                    value={customOrdinal}
                                                    onChange={(e) => setCustomOrdinal(Number(e.target.value))}
                                                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                                                >
                                                    <option value={1}>1st</option>
                                                    <option value={2}>2nd</option>
                                                    <option value={3}>3rd</option>
                                                    <option value={4}>4th</option>
                                                    <option value={-1}>Last</option>
                                                </select>
                                                <select
                                                    value={customWeekday}
                                                    onChange={(e) => setCustomWeekday(e.target.value)}
                                                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                                                >
                                                    {weekdayOptions.map(w => (
                                                        <option key={w.value} value={w.value}>{w.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                            onClick={() => setIsCustomOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                                            onClick={() => {
                                                const rule = buildCustomMonthlyRule()
                                                onChange(rule)
                                                setIsCustomOpen(false)
                                            }}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </Menu>
    )
}
