import { LikhoClient, LikhoProvider } from '@likho-ai/web-sdk';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

type Answer = (variables: Record<string, unknown>) => unknown;

/** A fake API: answers each operation by name; `null` means "nobody is signed in". */
export function fakeApi(answers: Record<string, Answer>) {
  const calls: { name: string; variables: Record<string, unknown> }[] = [];
  const impl = (async (_url: string, init: RequestInit) => {
    const { query, variables } = JSON.parse(init.body as string) as {
      query: string;
      variables: Record<string, unknown>;
    };
    const name = /(?:query|mutation) (\w+)/.exec(query)![1]!;
    calls.push({ name, variables });
    const errors = (code: string, message: string) =>
      new Response(JSON.stringify({ errors: [{ message, extensions: { code } }] }));
    const answer = answers[name];
    if (!answer) return errors('not_found', `no answer for ${name}`);
    const data = answer(variables);
    if (data === null) return errors('unauthenticated', 'Sign in first.');
    if (data instanceof Error) return errors('invalid', data.message);
    return new Response(JSON.stringify({ data }));
  }) as unknown as typeof fetch;
  return { client: new LikhoClient({ baseUrl: 'http://x', fetch: impl }), calls };
}

export const person = {
  id: 'usr_1',
  email: 'a@example.test',
  name: 'Asha',
  role: 'admin',
  workspace: { id: 'wsp_1', name: 'Test workspace' },
};

export function renderAt(path: string, element: ReactElement, client: LikhoClient) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LikhoProvider client={client} queryClient={queryClient}>
        {element}
      </LikhoProvider>
    </MemoryRouter>,
  );
}
