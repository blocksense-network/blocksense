'use client';

import { FormEvent, useCallback, useState } from 'react';
import { Effect } from 'effect';
import * as S from 'effect/Schema';

import { EmailSchema } from '@blocksense/base-utils/schemas';

import { getApiClient } from '@/service/client';

export default function FutureNodeForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onRegister = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      setError(null);

      if (!email || loading || success) return;
      if (!S.is(EmailSchema)(email)) return;

      setLoading(true);
      return Effect.runPromise(
        Effect.gen(function* () {
          const client = yield* getApiClient();
          yield* client.newsletter.register({
            payload: {
              email,
              interests: ['node'],
            },
          });
          setSuccess(true);
        }).pipe(
          Effect.catchAll(error => {
            console.error('Registration failed:', error.toString());
            setError('Registration failed');
            return Effect.succeed(undefined);
          }),
          Effect.tap(() => {
            setLoading(false);
            setEmail('');
          }),
        ),
      );
    },
    [email, loading],
  );

  return (
    <form
      onSubmit={onRegister}
      className="p-7 bg-[#e8e8e8] dark:bg-[#484848] rounded-2xl max-w-[50rem] mt-10 mx-auto"
    >
      <section className="mb-5">
        <p className="text-2xl mb-3">
          {success
            ? 'Thanks for your interest in running a node with Blocksense!'
            : 'Sign up as a future node operator'}
        </p>
        <p className="max-w-[29.313rem] leading-[22px]">
          {success
            ? 'We’re stoked you want to be part of what we’re building. We’ll be sharing more technical details and next steps with you shortly.'
            : 'Join the waitlist to become a reporter and help secure the next generation of decentralized data infrastructure.'}
        </p>
      </section>
      {!success && (
        <section className="flex items-start gap-3">
          <section className="flex flex-col gap-3 w-full">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="py-3 px-4 rounded-[6.25rem] w-full border"
            />
            <p className="text-red-500 text-xs">{error}</p>
          </section>
          <button
            type="submit"
            className="bg-[#1f1f1f] py-3 px-4 rounded-[6.25rem] cursor-pointer mt-0 border text-white"
            disabled={loading}
            style={{
              borderColor: 'white',
            }}
          >
            Subscribe
          </button>
        </section>
      )}

      <p className="text-xs mt-4">
        By providing your email address, you agree to receive communications
        from Blocksense Network that are consistent with{' '}
        <a
          href="https://blocksense.network/privacy-policy"
          className="underline"
        >
          our privacy policy.
        </a>
      </p>
    </form>
  );
}
