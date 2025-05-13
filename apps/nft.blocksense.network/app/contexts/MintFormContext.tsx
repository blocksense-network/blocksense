import React, {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useState,
} from 'react';

type VerificationStatus = {
  type: 'error' | 'success' | 'loading' | 'none';
  message: string;
};

type MintFormContextType = {
  xHandle: string;
  setXHandle: Dispatch<SetStateAction<string>>;
  xStatus: VerificationStatus;
  setXStatus: Dispatch<SetStateAction<VerificationStatus>>;

  discord: string;
  setDiscord: Dispatch<SetStateAction<string>>;
  discordStatus: VerificationStatus;
  setDiscordStatus: Dispatch<SetStateAction<VerificationStatus>>;

  alertMessage: string;
  setAlertMessage: Dispatch<SetStateAction<string>>;
  mintLoading: boolean;
  setMintLoading: Dispatch<SetStateAction<boolean>>;
};

const MintFormContext = createContext<MintFormContextType>(
  {} as MintFormContextType,
);

export const MintFormProvider = ({ children }: { children: ReactNode }) => {
  const [xHandle, setXHandle] = useState('');
  const [xStatus, setXStatus] = useState<VerificationStatus>({
    type: 'none',
    message: '',
  });

  const [discord, setDiscord] = useState('');
  const [discordStatus, setDiscordStatus] = useState<VerificationStatus>({
    type: 'none',
    message: '',
  });

  const [alertMessage, setAlertMessage] = useState('');
  const [mintLoading, setMintLoading] = useState(false);

  return (
    <MintFormContext.Provider
      value={{
        xHandle,
        setXHandle,
        xStatus,
        setXStatus,
        discord,
        setDiscord,
        discordStatus,
        setDiscordStatus,
        alertMessage,
        setAlertMessage,
        mintLoading,
        setMintLoading,
      }}
    >
      {children}
    </MintFormContext.Provider>
  );
};

export const useMintFormContext = () => {
  const context = useContext(MintFormContext);
  if (!context) {
    throw new Error(
      'useMintFormContext must be used within a MintFormProvider',
    );
  }
  return context;
};
