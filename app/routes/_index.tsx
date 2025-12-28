import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import { SkipLink } from '~/components/ui/SkipLink';

export const meta: MetaFunction = () => {
  return [
    { title: 'BAVINI' },
    { name: 'description', content: 'Discutez avec BAVINI, votre assistant IA de développement web' },
  ];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full">
      <SkipLink targetId="main-content">Aller au contenu principal</SkipLink>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-hidden">
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </main>
    </div>
  );
}
