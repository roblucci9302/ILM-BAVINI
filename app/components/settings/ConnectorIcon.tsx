import { memo } from 'react';
import { classNames } from '~/utils/classNames';

interface ConnectorIconProps {
  icon: string;
  className?: string;
}

// SVG icons for each connector - Core services only
const icons: Record<string, JSX.Element> = {
  supabase: (
    <svg viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
        fill="url(#paint0_linear)"
      />
      <path
        d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
        fill="url(#paint1_linear)"
        fillOpacity="0.2"
      />
      <path
        d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z"
        fill="#3ECF8E"
      />
      <defs>
        <linearGradient
          id="paint0_linear"
          x1="53.9738"
          y1="54.974"
          x2="94.1635"
          y2="71.8295"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#249361" />
          <stop offset="1" stopColor="#3ECF8E" />
        </linearGradient>
        <linearGradient
          id="paint1_linear"
          x1="36.1558"
          y1="30.578"
          x2="54.4844"
          y2="65.0806"
          gradientUnits="userSpaceOnUse"
        >
          <stop />
          <stop offset="1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  ),
  netlify: (
    <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M177.381 169.733L179.202 168.991L180.478 168.47L182.377 167.729L185.986 166.339V166.206L161.023 141.108H160.889L143.237 158.625L177.381 169.733Z"
        fill="#00C7B7"
      />
      <path
        d="M149.689 102.262L180.478 133.051L185.852 127.811V127.677L152.575 94.5343L149.689 102.262Z"
        fill="#00C7B7"
      />
      <path
        d="M108.515 154.968H108.382L91.0008 172.35L128.001 202.776L128.135 202.642L108.515 154.968Z"
        fill="#00C7B7"
      />
      <path
        d="M153.308 138.635L128.135 113.462L91.0008 80.3196L90.8674 80.453V80.5864L117.672 149.05L153.308 138.635Z"
        fill="#00C7B7"
      />
      <path d="M69.0008 97.0689V159.221L90.8674 80.453L69.1341 97.0689H69.0008Z" fill="#00C7B7" />
      <path d="M69.0008 159.221L128.001 202.642L91.1341 172.35L69.0008 159.221Z" fill="#00C7B7" />
      <path
        d="M185.986 127.677L186.12 127.811V166.206L186.253 166.073L220.13 132.196L185.986 127.677Z"
        fill="#00C7B7"
      />
      <path
        d="M128.001 53.2239L69.0008 97.0689L90.8674 80.453L128.135 113.462L149.689 102.262L152.575 94.5343L128.135 53.0905L128.001 53.2239Z"
        fill="#00C7B7"
      />
      <path
        d="M186.12 166.206V127.811L180.478 133.051L180.344 133.185L177.381 169.733L186.253 166.073L186.12 166.206Z"
        fill="#00C7B7"
      />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 0C5.37 0 0 5.37 0 12C0 17.31 3.435 21.795 8.205 23.385C8.805 23.49 9.03 23.13 9.03 22.815C9.03 22.53 9.015 21.585 9.015 20.58C6 21.135 5.22 19.845 4.98 19.17C4.845 18.825 4.26 17.76 3.75 17.475C3.33 17.25 2.73 16.695 3.735 16.68C4.68 16.665 5.355 17.55 5.58 17.91C6.66 19.725 8.385 19.215 9.075 18.9C9.18 18.12 9.495 17.595 9.84 17.295C7.17 16.995 4.38 15.96 4.38 11.37C4.38 10.065 4.845 8.985 5.61 8.145C5.49 7.845 5.07 6.615 5.73 4.965C5.73 4.965 6.735 4.65 9.03 6.195C9.99 5.925 11.01 5.79 12.03 5.79C13.05 5.79 14.07 5.925 15.03 6.195C17.325 4.635 18.33 4.965 18.33 4.965C18.99 6.615 18.57 7.845 18.45 8.145C19.215 8.985 19.68 10.05 19.68 11.37C19.68 15.975 16.875 16.995 14.205 17.295C14.64 17.67 15.015 18.39 15.015 19.515C15.015 21.12 15 22.41 15 22.815C15 23.13 15.225 23.505 15.825 23.385C18.2072 22.5807 20.2772 21.0497 21.7437 19.0074C23.2101 16.965 23.9993 14.5143 24 12C24 5.37 18.63 0 12 0Z"
        fill="currentColor"
      />
    </svg>
  ),
};

export const ConnectorIcon = memo(({ icon, className }: ConnectorIconProps) => {
  const IconComponent = icons[icon];

  if (!IconComponent) {
    // fallback icon
    return (
      <div
        className={classNames(
          'flex items-center justify-center bg-bolt-elements-background-depth-2 rounded',
          className,
        )}
      >
        <span className="i-ph:plug text-bolt-elements-textSecondary" />
      </div>
    );
  }

  return <div className={classNames('flex items-center justify-center', className)}>{IconComponent}</div>;
});
