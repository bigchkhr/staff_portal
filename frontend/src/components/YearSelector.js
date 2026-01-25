import React, { useState, useEffect } from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { AVAILABLE_YEARS } from '../constants/years';

/**
 * 統一的年份選擇器組件
 * @param {Object} props
 * @param {number} props.value - 選中的年份值
 * @param {Function} props.onChange - 年份改變時的回調函數 (year) => void
 * @param {string} props.label - 標籤文字（可選，預設使用翻譯）
 * @param {string} props.labelKey - 翻譯鍵（可選，預設為 'year'）
 * @param {boolean} props.required - 是否必填
 * @param {boolean} props.disabled - 是否禁用
 * @param {string} props.suffix - 年份後綴（可選，如 '年'）
 * @param {Object} props.sx - 樣式屬性
 * @param {string} props.fullWidth - 是否全寬
 */
const YearSelector = ({
  value,
  onChange,
  label,
  labelKey = 'year',
  required = false,
  disabled = false,
  suffix = '',
  sx = {},
  fullWidth = false
}) => {
  const { t } = useTranslation();
  const displayLabel = label || t(labelKey);
  const [years, setYears] = useState(AVAILABLE_YEARS);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await axios.get('/api/system-years/active');
        if (response.data && response.data.length > 0) {
          setYears(response.data);
        }
      } catch (error) {
        // 如果 API 失敗，使用預設的年份常量
        console.warn('Failed to fetch system years, using default:', error);
      }
    };
    fetchYears();
  }, []);

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <FormControl 
      fullWidth={fullWidth} 
      required={required}
      disabled={disabled}
      sx={sx}
    >
      <InputLabel>{displayLabel}</InputLabel>
      <Select
        value={value}
        label={displayLabel}
        onChange={handleChange}
        required={required}
        disabled={disabled}
      >
        {years.map((year) => (
          <MenuItem key={year} value={year}>
            {year}{suffix}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default YearSelector;

