import { configureStore } from '@reduxjs/toolkit';
import monthlyReportGeneratePreferenceReducer from './slices/monthlyReportGeneratePreferenceSlice';
import monthlyAttendanceSummaryDateRangeReducer from './slices/monthlyAttendanceSummaryDateRangeSlice';

export const store = configureStore({
  reducer: {
    monthlyReportGeneratePreference: monthlyReportGeneratePreferenceReducer,
    monthlyAttendanceSummaryDateRange: monthlyAttendanceSummaryDateRangeReducer
  }
});
