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
  xUserId: string | null;
  setXUserId: Dispatch<SetStateAction<string | null>>;

  discord: string;
  setDiscord: Dispatch<SetStateAction<string>>;
  discordStatus: VerificationStatus;
  setDiscordStatus: Dispatch<SetStateAction<VerificationStatus>>;

  retweetStatus: VerificationStatus;
  setRetweetStatus: Dispatch<SetStateAction<VerificationStatus>>;
  retweetCode: string;
  setRetweetCode: Dispatch<SetStateAction<string>>;

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
  const [xUserId, setXUserId] = useState<string | null>(null);

  const [discord, setDiscord] = useState('');
  const [discordStatus, setDiscordStatus] = useState<VerificationStatus>({
    type: 'none',
    message: '',
  });

  const [retweetStatus, setRetweetStatus] = useState<VerificationStatus>({
    type: 'none',
    message: '',
  });
  const [retweetCode, setRetweetCode] = useState('');

  const [alertMessage, setAlertMessage] = useState('');
  const [mintLoading, setMintLoading] = useState(false);

  return (
    <MintFormContext.Provider
      value={{
        xHandle,
        setXHandle,
        xStatus,
        setXStatus,
        xUserId,
        setXUserId,
        discord,
        setDiscord,
        discordStatus,
        setDiscordStatus,
        retweetStatus,
        setRetweetStatus,
        retweetCode,
        setRetweetCode,
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
