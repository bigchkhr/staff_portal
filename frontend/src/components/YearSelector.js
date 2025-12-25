import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
        {AVAILABLE_YEARS.map((year) => (
          <MenuItem key={year} value={year}>
            {year}{suffix}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default YearSelector;

