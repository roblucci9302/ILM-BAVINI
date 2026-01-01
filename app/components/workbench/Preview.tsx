import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { selectedDeviceId } from '~/lib/stores/previews';
import { DEVICE_PRESETS } from '~/utils/devices';
import { PortDropdown } from './PortDropdown';
import { DeviceSelector } from './DeviceSelector';
import { DeviceFrame } from './DeviceFrame';

export const Preview = memo(() => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasSelectedPreview, setHasSelectedPreview] = useState(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const currentDeviceId = useStore(selectedDeviceId);
  const currentDevice = DEVICE_PRESETS.find((d) => d.id === currentDeviceId);
  const isDesktop = currentDevice?.type === 'desktop';

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === fullscreenContainerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const enterFullscreen = useCallback(() => {
    if (fullscreenContainerRef.current) {
      fullscreenContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Erreur plein écran:', err);
        toast.error('Impossible de passer en plein écran');
      });
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.error('Erreur sortie plein écran:', err);
        toast.error('Impossible de quitter le plein écran');
      });
    }
  }, []);

  useEffect(() => {
    if (!activePreview) {
      setUrl('');
      setIframeUrl(undefined);

      return;
    }

    const { baseUrl } = activePreview;

    setUrl(baseUrl);
    setIframeUrl(baseUrl);
  }, [activePreview]);

  const validateUrl = useCallback(
    (value: string) => {
      if (!activePreview) {
        return false;
      }

      const { baseUrl } = activePreview;

      if (value === baseUrl) {
        return true;
      } else if (value.startsWith(baseUrl)) {
        return ['/', '?', '#'].includes(value.charAt(baseUrl.length));
      }

      return false;
    },
    [activePreview],
  );

  const findMinPortIndex = useCallback(
    (minIndex: number, preview: { port: number }, index: number, array: { port: number }[]) => {
      return preview.port < array[minIndex].port ? index : minIndex;
    },
    [],
  );

  // when previews change, display the lowest port if user hasn't selected a preview
  useEffect(() => {
    if (previews.length > 1 && !hasSelectedPreview) {
      const minPortIndex = previews.reduce(findMinPortIndex, 0);

      setActivePreviewIndex(minPortIndex);
    }
  }, [previews, findMinPortIndex, hasSelectedPreview]);

  const reloadPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="p-2.5 flex items-center gap-2">
        <IconButton icon="i-ph:arrow-clockwise" title="Recharger l'aperçu" onClick={reloadPreview} />
        <IconButton
          icon="i-ph:arrows-out"
          title="Plein écran"
          onClick={enterFullscreen}
          disabled={!iframeUrl || !activePreview?.ready}
        />
        <div
          className="flex items-center gap-1.5 flex-grow bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-xl px-3.5 py-1.5 text-sm transition-all duration-200 hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:border-accent-500/50 focus-within:text-bolt-elements-preview-addressBar-textActive focus-within:ring-2 focus-within:ring-accent-500/20"
        >
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={url}
            aria-label="Barre d'adresse de l'aperçu"
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && validateUrl(url)) {
                setIframeUrl(url);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
          />
        </div>
        {previews.length > 1 && (
          <PortDropdown
            activePreviewIndex={activePreviewIndex}
            setActivePreviewIndex={setActivePreviewIndex}
            isDropdownOpen={isPortDropdownOpen}
            setHasSelectedPreview={setHasSelectedPreview}
            setIsDropdownOpen={setIsPortDropdownOpen}
            previews={previews}
          />
        )}
        {/* Separator */}
        <div className="w-px h-5 bg-bolt-elements-borderColor/50" />
        {/* Device selector */}
        <DeviceSelector />
      </div>
      <div
        ref={fullscreenContainerRef}
        className="flex-1 border-t border-[var(--bolt-glass-border)] overflow-hidden relative"
      >
        {activePreview ? (
          activePreview.ready ? (
            isDesktop ? (
              <iframe
                ref={iframeRef}
                className="border-none w-full h-full bg-white"
                src={iframeUrl}
                title="Aperçu de l'application"
              />
            ) : (
              <DeviceFrame>
                <iframe
                  ref={iframeRef}
                  className="border-none w-full h-full bg-white"
                  src={iframeUrl}
                  title="Aperçu de l'application"
                />
              </DeviceFrame>
            )
          ) : (
            <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-accent-500/10 flex items-center justify-center">
                    <div className="i-svg-spinners:90-ring-with-bg text-accent-500 text-2xl" />
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-bolt-elements-textPrimary font-medium">Démarrage du serveur</span>
                  <p className="text-bolt-elements-textTertiary text-sm mt-1">Préparation de l'aperçu...</p>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-bolt-elements-background-depth-3 flex items-center justify-center">
                <div className="i-ph:eye-slash text-3xl text-bolt-elements-textTertiary" />
              </div>
              <div>
                <span className="text-bolt-elements-textSecondary font-medium">Aucun aperçu disponible</span>
                <p className="text-bolt-elements-textTertiary text-sm mt-1">Lancez le serveur pour voir l'aperçu</p>
              </div>
            </div>
          </div>
        )}

        {/* Floating exit button - macOS style - only visible in fullscreen */}
        {isFullscreen && (
          <button
            onClick={exitFullscreen}
            className="group absolute top-4 left-4 z-50 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full transition-all flex items-center justify-center shadow-sm"
            title="Quitter le plein écran (Échap)"
          >
            <div className="i-ph:x-bold text-xs text-red-900 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  );
});

Preview.displayName = 'Preview';
