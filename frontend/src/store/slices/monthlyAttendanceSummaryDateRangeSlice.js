import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  start_date: null,
  end_date: null
};

const monthlyAttendanceSummaryDateRangeSlice = createSlice({
  name: 'monthlyAttendanceSummaryDateRange',
  initialState,
  reducers: {
    setMonthlyAttendanceSummaryDateRange: (state, action) => {
      const { start_date, end_date } = action.payload || {};
      state.start_date = typeof start_date === 'string' ? start_date : null;
      state.end_date = typeof end_date === 'string' ? end_date : null;
    },
    clearMonthlyAttendanceSummaryDateRange: () => initialState
  }
});

export const { setMonthlyAttendanceSummaryDateRange, clearMonthlyAttendanceSummaryDateRange } =
  monthlyAttendanceSummaryDateRangeSlice.actions;

export default monthlyAttendanceSummaryDateRangeSlice.reducer;
