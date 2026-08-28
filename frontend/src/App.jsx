import { useEffect, useRef, useState } from 'react';
import { identifyAnimal, fileToBase64, USE_MOCK } from './api/client.js';
import { MOCK_ANIMALS, DEFAULT_MOCK_ID } from './api/mockAnimals.js';
import { usePassport } from './hooks/usePassport.js';
import FactsView from './components/FactsView.jsx';
import Passport from './components/Passport.jsx';
import DistributionMap from './components/DistributionMap.jsx';
import AhMengChat from './components/AhMengChat.jsx';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED = ['image/jpeg', 'image/png'];

export default function App() {
  const [ageMode, setAgeMode] = useState('kids'); // default Kids (Requirement 2.3)
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [fieldError, setFieldError] = useState('');
  const [mockId, setMockId] = useState(DEFAULT_MOCK_ID); // which mock animal to return
  const fileInputRef = useRef(null);

  const { species: passport, addSpecies, badge } = usePassport();

  // Revoke object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // QR deep-link: ?species=<name> skips the photo step (Requirement 13).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrSpecies = params.get('species');
    if (qrSpecies) {
      runIdentify({ species: qrSpecies });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickFile(e) {
    setFieldError('');
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (!ACCEPTED.includes(picked.type)) {
      setFieldError('Please choose a JPEG or PNG image.');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFieldError('That image is larger than 10 MB. Please choose a smaller one.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setResult(null);
  }

  async function runIdentify(extra = {}) {
    setLoading(true);
    setResult(null);
    try {
      let payload = { ageMode, mockId, ...extra };
      if (!extra.species) {
        if (!file) {
          setFieldError('Please choose a photo first.');
          return;
        }
        const { base64, mediaType } = await fileToBase64(file);
        payload = { ...payload, image: base64, mediaType };
      }
      const res = await identifyAnimal(payload);
      setResult(res);
      if (res.confident && res.species) {
        addSpecies(res.species);
      }
    } finally {
      setLoading(false);
    }
  }

  const isError =
    result &&
    !result.confident &&
    result.clarify_prompt === 'Sorry, something went wrong. Please try again.';
  const isLowConfidence = result && !result.confident && !isError;
  const isConfident = result && result.confident;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Mandai Wild Discovery</h1>
        <p>Snap an animal and discover its story.</p>
      </header>

      <div className="controls">
        {USE_MOCK && (
          <label className="mock-picker">
            <span>Demo animal (mock mode)</span>
            <select
              className="lang-select"
              value={mockId}
              onChange={(e) => setMockId(e.target.value)}
              disabled={loading}
              aria-label="Choose which animal the mock returns"
            >
              {MOCK_ANIMALS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.species}
                </option>
              ))}
              <option value="not-confident">(Low-confidence response)</option>
            </select>
          </label>
        )}

        <div className="age-toggle" role="group" aria-label="Reading level">
          <button
            type="button"
            className={ageMode === 'kids' ? 'active' : ''}
            onClick={() => setAgeMode('kids')}
            aria-pressed={ageMode === 'kids'}
          >
            Kids
          </button>
          <button
            type="button"
            className={ageMode === 'adult' ? 'active' : ''}
            onClick={() => setAgeMode('adult')}
            aria-pressed={ageMode === 'adult'}
          >
            Adult
          </button>
        </div>

        <label className="photo-label">
          <input
            ref={fileInputRef}
            className="photo-input"
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            onChange={onPickFile}
            disabled={loading}
          />
          <span className="btn btn-secondary" role="button">
            {file ? 'Choose a different photo' : 'Take or choose a photo'}
          </span>
        </label>

        {previewUrl && (
          <div className="preview-wrap">
            <img src={previewUrl} alt="Selected animal" />
          </div>
        )}

        {fieldError && <p className="field-error">{fieldError}</p>}

        <button
          type="button"
          className="btn"
          style={{ marginTop: 14 }}
          onClick={() => runIdentify()}
          disabled={loading || !file}
        >
          Identify animal
        </button>
      </div>

      {loading && (
        <div className="loading">
          <span className="spinner" aria-hidden="true" />
          Identifying…
        </div>
      )}

      {!loading && isError && (
        <div className="error-box">{result.clarify_prompt}</div>
      )}

      {!loading && isLowConfidence && (
        <div className="clarify">{result.clarify_prompt}</div>
      )}

      {!loading && isConfident && (
        <>
          <FactsView species={result.species} facts={result.facts} />
          <DistributionMap species={result.species} />
          <AhMengChat species={result.species} facts={result.facts} mockId={mockId} />
        </>
      )}

      <Passport species={passport} badge={badge} />
    </div>
  );
}
