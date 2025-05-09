import { ChangeEvent, useEffect } from 'react';

import { useMintFormContext } from './MintFormContext';
import { Input } from './Input';
import { isXUserFollowing } from 'service/client';

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
    setXStatus({ type: 'loading', message: '' });
    try {
      if (xHandle[0] === '@') {
        setXStatus({
          type: 'error',
          message: 'X handle should not start with @',
        });
        return;
      }

      const { isFollowing, userId } = await isXUserFollowing(xHandle);
      setXUserId(userId);
      if (!isFollowing) {
        setXStatus({ type: 'error', message: 'You are not following us on X' });
        return;
      }

      setXStatus({ type: 'success', message: 'User verified successfully' });
    } catch (err) {
      console.error(err);
      setXStatus({ type: 'error', message: 'You are not following us on X' });
    }
  };

  return (
    <Input
      value={xHandle}
      onChange={onXHandleChange}
      placeholder="X handle"
      id="x-handle"
      status={xStatus.type}
      message={xStatus.message}
    />
  );
};
