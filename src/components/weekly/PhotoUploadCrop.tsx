import { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Button from '../ui/Button';

interface PhotoUploadCropProps {
  label: string;
  onSave: (base64: string) => void;
  existing?: string;
  required?: boolean;
}

function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, crop.width, crop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.75);
  });
}

export default function PhotoUploadCrop({ label, onSave, existing, required }: PhotoUploadCropProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [saved, setSaved] = useState(!!existing);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    setCompletedCrop({
      unit: 'px',
      x: Math.round(img.width * 0.1),
      y: Math.round(img.height * 0.1),
      width: Math.round(img.width * 0.8),
      height: Math.round(img.height * 0.8),
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Photo trop lourde (max 15 Mo). Compresse l\'image avant de l\'importer.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setSrc(reader.result as string); setSaved(false); };
    reader.readAsDataURL(file);
  }

  const handleSaveCrop = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;
    const cropped = await getCroppedImg(imgRef.current, completedCrop);
    onSave(cropped);
    setSaved(true);
    setSrc(null);
  }, [completedCrop, onSave]);

  if (saved && existing) {
    return (
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">
          {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
        </div>
        <div className="relative inline-block">
          <img src={existing} alt={label} className="w-24 h-24 object-cover rounded-lg" style={{ border: '2px solid var(--green)' }} />
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: 'var(--green)', color: 'var(--bg)' }}>✓</div>
        </div>
        <button
          onClick={() => { setSaved(false); setSrc(null); if (fileRef.current) fileRef.current.value = ''; }}
          className="block text-xs mt-1 text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Changer
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-2">
        {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </div>

      {!src ? (
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-24 rounded-lg border-2 border-dashed text-[var(--muted)] hover:border-[var(--blue)] hover:text-[var(--blue)] transition-colors flex flex-col items-center justify-center gap-1"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs">Choisir une photo</span>
          </button>
          <p className="text-xs text-[var(--muted2)] mt-1">
            Pose standardisée — même éclairage, même distance chaque semaine.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--gold)]">
            ✂ Recadre pour exclure le visage avant de confirmer.
          </p>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={undefined}
          >
            <img
              ref={imgRef}
              src={src}
              alt="preview"
              onLoad={handleImageLoad}
              style={{ maxHeight: 400, maxWidth: '100%' }}
            />
          </ReactCrop>
          <div className="px-3 py-2 rounded-lg text-xs leading-relaxed" style={{ background: 'rgba(47,227,154,0.06)', border: '1px solid rgba(47,227,154,0.2)', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--green)' }}>🔒 Confidentialité —</span> Seule la zone rognée est sauvegardée. L'original (avec le visage) est immédiatement effacé de la mémoire et n'est jamais stocké. Tes photos restent sur cet appareil et, si Supabase est activé, dans le projet privé du groupe — accessible uniquement aux membres via la clé du groupe. L'analyse IA (optionnelle, lancée par l'admin) transmet uniquement la zone rognée à l'API Anthropic pour évaluer la progression physique.
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveCrop} disabled={!completedCrop} size="sm">
              Confirmer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSrc(null)}>
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}