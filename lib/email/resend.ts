import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { render } from 'react-email';
import { Resend } from 'resend';
import type { ReactElement } from 'react';

const MOCK_INVITATION_HTML_PATH = '/tmp/opencode/last-invitation-email.html';

export type ResendSendResult =
  | { data: { id: string }; error: null }
  | { data: null; error: { message: string } };

export interface ResendSendArgs {
  from: string;
  to: string;
  subject: string;
  react: ReactElement;
}

export interface ResendClient {
  emails: {
    send: (args: ResendSendArgs) => Promise<ResendSendResult>;
  };
}

const buildMockClient = (): ResendClient => {
  return {
    emails: {
      send: async ({ react }: ResendSendArgs): Promise<ResendSendResult> => {
        const html = await render(react);
        await fs.mkdir(path.dirname(MOCK_INVITATION_HTML_PATH), { recursive: true });
        await fs.writeFile(MOCK_INVITATION_HTML_PATH, html, 'utf8');
        return { data: { id: `mock-${Date.now()}` }, error: null };
      },
    },
  };
};

const buildRealClient = (apiKey: string): ResendClient => {
  const resend = new Resend(apiKey);
  return {
    emails: {
      send: async (args: ResendSendArgs): Promise<ResendSendResult> => {
        return resend.emails.send(args);
      },
    },
  };
};

export const getResendClient = (): ResendClient => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 'mock') {
    return buildMockClient();
  }
  return buildRealClient(apiKey);
};
