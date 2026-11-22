export default function ChoiceOption({
  type = 'radio',
  name,
  checked,
  onChange,
  title,
  hint,
  disabled = false,
}) {
  return (
    <label className={`choice-option${type === 'checkbox' ? ' is-checkbox' : ''}${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}>
      <input
        className="choice-input"
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="choice-mark" aria-hidden="true" />
      <span className="choice-copy">
        <strong>{title}</strong>
        {hint ? <span>{hint}</span> : null}
      </span>
    </label>
  );
}
