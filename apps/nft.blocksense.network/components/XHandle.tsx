import { ChangeEvent, useEffect } from 'react';

import { isXUserFollowing } from 'service/client';
import { clearXHandle } from '@/utils';
import { useMintFormContext } from '../app/contexts/MintFormContext';
import { Input } from './Input';

export const XHandle = () => {
  const { xHandle, setXHandle, xStatus, setXStatus, mintLoading } =
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
    if (mintLoading) return;
    setXHandle(e.target.value);
    setXStatus({ type: 'none', message: '' });
  };

  const verifyXHandle = async () => {
    const resultXHandle = clearXHandle(xHandle);
    if (resultXHandle === '') return;

    setXStatus({ type: 'loading', message: '' });
    try {
      // const { isFollowing } = await isXUserFollowing(resultXHandle);
      // if (isFollowing) {
      setXStatus({ type: 'success', message: 'You are following us on X' });
      // } else {
      //   throw new Error('User is not following us on X');
      // }
    } catch (err) {
      console.error(err);
      setXStatus({ type: 'error', message: 'You are not following us on X' });
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
