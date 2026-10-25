import type { Settings } from '../../../shared/contracts';
function localTime(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function SettingsEditor({
  value,
  onChange,
}: {
  value: Settings;
  onChange: (settings: Settings) => void;
}) {
  const update = (patch: Partial<Settings>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="panel stack">
      <legend>Session settings</legend>
      <label className="check">
        <input
          type="checkbox"
          checked={value.studentAI}
          onChange={(e) => update({ studentAI: e.target.checked })}
        />{' '}
        Student AI enabled
      </label>
      <label>
        Student hint policy
        <select
          value={value.hintPolicy}
          onChange={(e) => update({ hintPolicy: e.target.value as Settings['hintPolicy'] })}
        >
          <option value="conceptual">Conceptual hints</option>
          <option value="step">Step-specific hints</option>
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={value.taAI}
          onChange={(e) => update({ taAI: e.target.checked })}
        />{' '}
        TA AI enabled
      </label>
      <div className="two-columns">
        <label>
          Opens (local time)
          <input
            type="datetime-local"
            required
            value={localTime(value.opensAt)}
            onChange={(e) => {
              if (e.target.value) update({ opensAt: new Date(e.target.value).toISOString() });
            }}
          />
        </label>
        <label>
          Closes (local time)
          <input
            type="datetime-local"
            required
            value={localTime(value.closesAt)}
            onChange={(e) => {
              if (e.target.value) update({ closesAt: new Date(e.target.value).toISOString() });
            }}
          />
        </label>
      </div>
    </fieldset>
  );
}
