import { X } from '../icons';
import GroupMemberPicker from './GroupMemberPicker';
import { useEp } from '../useEp';

export default function RelatedPeopleFields({ people = [], onChange, disabled = false, ownerGroupId }) {
  const t = useEp();

  function addPerson(user) {
    if (people.some((person) => Number(person.id) === Number(user.id))) return;
    onChange([...people, user]);
  }

  function removePerson(userId) {
    onChange(people.filter((person) => Number(person.id) !== Number(userId)));
  }

  return (
    <>
      <GroupMemberPicker
        ownerGroupId={ownerGroupId}
        disabled={disabled}
        actionLabel={t('picker.add')}
        onSelect={addPerson}
      />
      {people.length > 0 && (
        <div className="chip-list">
          {people.map((person) => (
            <span className="chip" key={person.id}>
              {person.display_name || person.username}
              <button
                type="button"
                className="icon-button"
                disabled={disabled}
                onClick={() => removePerson(person.id)}
                aria-label={t('picker.remove')}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
