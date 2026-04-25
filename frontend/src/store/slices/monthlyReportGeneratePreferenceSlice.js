import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  year: null,
  month: null
};

const monthlyReportGeneratePreferenceSlice = createSlice({
  name: 'monthlyReportGeneratePreference',
  initialState,
  reducers: {
    setMonthlyReportGeneratePreference: (state, action) => {
      const { year, month } = action.payload || {};
      state.year = typeof year === 'number' ? year : null;
      state.month = typeof month === 'number' ? month : null;
    },
    clearMonthlyReportGeneratePreference: () => initialState
  }
});

export const { setMonthlyReportGeneratePreference, clearMonthlyReportGeneratePreference } =
  monthlyReportGeneratePreferenceSlice.actions;

export default monthlyReportGeneratePreferenceSlice.reducer;
