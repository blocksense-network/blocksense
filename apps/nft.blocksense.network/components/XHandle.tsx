import { ChangeEvent, useEffect } from 'react';

import { isXUserFollowing } from 'service/client';
import { clearXHandle } from '@/utils';
import { useMintFormContext } from '../app/contexts/MintFormContext';
import { Input } from './Input';

export const XHandle = () => {
  const { xHandle, setXHandle, xStatus, setXStatus, setXUserId } =
    useMintFormContext();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (xHandle) {
        verifyXHandle();
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [xHandle]);

  const onXHandleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setXHandle(e.target.value);
    setXStatus({ type: 'none', message: '' });
  };

  const verifyXHandle = async () => {
    const resultXHandle = clearXHandle(xHandle);
    if (resultXHandle === '') return;

    setXStatus({ type: 'loading', message: '' });
    try {
      const { isFollowing, userId } = await isXUserFollowing(resultXHandle);
      if (isFollowing && userId) {
        setXStatus({ type: 'success', message: 'You are following us on X' });
        setXUserId(userId);
      } else {
        throw new Error('User is not following us on X');
      }
    } catch (err) {
      console.error(err);
      setXStatus({ type: 'error', message: 'You are not following us on X' });
      setXUserId(null);
    }
  };

  return (
    <Input
      value={xHandle}
      onChange={onXHandleChange}
      placeholder="X Handle"
      id="x-handle"
      status={xStatus.type}
      message={xStatus.message}
    />
  );
};
