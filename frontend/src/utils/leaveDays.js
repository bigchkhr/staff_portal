import axios from 'axios';
import { toHKDayjs } from './dateFormat';

const toDayjs = (value) => toHKDayjs(value);

export const calculateWorkingDays = (startDate, endDate) => {
  const start = toDayjs(startDate);
  const end = toDayjs(endDate);
  if (!start || !end) return 0;

  let count = 0;
  let current = start;
  while (current.isBefore(end, 'day') || current.isSame(end, 'day')) {
    const dayOfWeek = current.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current = current.add(1, 'day');
  }
  return count;
};

export const getPublicHolidaysCount = async (startDate, endDate, startSession, endSession) => {
  const start = toDayjs(startDate);
  const end = toDayjs(endDate);
  if (!start || !end) return 0;

  try {
    const response = await axios.get('/api/public-holidays/range', {
      params: {
        start_date: start.format('YYYY-MM-DD'),
        end_date: end.format('YYYY-MM-DD')
      }
    });
    const holidays = response.data.publicHolidays || [];
    if (holidays.length === 0) return 0;

    let count = 0;
    holidays.forEach((holiday) => {
      const holidayDate = toHKDayjs(holiday.date);
      if (!holidayDate) return;
      if (holidayDate.isSame(start, 'day')) {
        if (start.isSame(end, 'day')) {
          count += startSession === 'AM' && endSession === 'PM' ? 1 : 0.5;
        } else {
          count += startSession === 'AM' ? 1 : 0.5;
        }
      } else if (holidayDate.isSame(end, 'day')) {
        count += endSession === 'PM' ? 1 : 0.5;
      } else {
        count += 1;
      }
    });
    return count;
  } catch (error) {
    console.error('Get public holidays error:', error);
    return 0;
  }
};

export const calculateLeaveDays = async (
  startDate,
  endDate,
  startSession,
  endSession,
  includeWeekends,
  excludePublicHolidays
) => {
  const start = toDayjs(startDate);
  const end = toDayjs(endDate);
  if (!start || !end || !startSession || !endSession) return 0;

  const baseDays = includeWeekends
    ? end.diff(start, 'day') + 1
    : calculateWorkingDays(start, end);

  const publicHolidaysDeduction = excludePublicHolidays
    ? await getPublicHolidaysCount(start, end, startSession, endSession)
    : 0;

  if (start.isSame(end, 'day')) {
    let days = 0.5;
    if (startSession === 'AM' && endSession === 'PM') {
      days = 1;
    }
    return Math.max(0, days - publicHolidaysDeduction);
  }

  let days = baseDays;
  if (startSession === 'AM' && endSession === 'AM') {
    days = baseDays - 0.5;
  } else if (startSession === 'PM' && endSession === 'PM') {
    days = baseDays - 0.5;
  } else if (startSession === 'PM' && endSession === 'AM') {
    days = baseDays - 1;
  }

  return Math.max(0, days - publicHolidaysDeduction);
};
