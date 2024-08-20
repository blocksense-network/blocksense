import * as React from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';

import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select';

type Column =
  | 'id'
  | 'name'
  | 'description'
  | 'report interval'
  | 'decimals'
  | 'aggregator'
  | 'base'
  | 'quote'
  | 'chainlink aggregator';

type EthereumAddress = `0x${string}`;

type SupportedChainId =
  | '1'
  | '11155111'
  | '17000'
  | '80002'
  | '3441006'
  | '43113'
  | '10200'
  | '11155420'
  | '300'
  | '84532'
  | '13527'
  | '534351'
  | '421614'
  | '80085'
  | '167009';

type NetworkAddresses = {
  [chainId in SupportedChainId]?: EthereumAddress;
};

type DataFeedModel = {
  id: number;
  name: string;
  decimals: number;
  description: string;
  report_interval_ms: number;
  chainlink_compatiblity?: {
    base: EthereumAddress | NetworkAddresses;
    quote: EthereumAddress | NetworkAddresses;
  };
  address?: EthereumAddress;
  base?: EthereumAddress;
  quote?: EthereumAddress;
  chainlink_proxy?: EthereumAddress;
};

type ParametersProps = {
  feeds: DataFeedModel[];
  networks: Record<string, any>;
  title?: string;
  parentTitle?: string;
  titleLevel?: 4 | 5;
  columns?: Column[];
};

const columnNames = {
  id: 'ID',
  name: 'Name',
  description: 'Description',
  'report interval': 'Heartbeat',
  decimals: 'Dec',
  aggregator: 'Aggregator',
  base: 'base',
  quote: 'quote',
  'chainlink aggregator': 'Chainlink Aggregator',
};

function showHexValue(hexValue: string) {
  const startPart = hexValue.substring(0, 4);
  const endPart = hexValue.substring(hexValue.length - 4);
  const truncatedStr = `${startPart}...${endPart}`;
  return truncatedStr;
}

const getParameterValueByColumn = (dataFeed: DataFeedModel, column: string) => {
  switch (column) {
    case 'id':
      return dataFeed.id;
    case 'name':
      return dataFeed.name;
    case 'description':
      return dataFeed.description;
    case 'report interval':
      return dataFeed.report_interval_ms;
    case 'decimals':
      return dataFeed.decimals;
    case 'aggregator':
      return dataFeed.address ? showHexValue(dataFeed.address) : '-';
    case 'base':
      return dataFeed.base ? showHexValue(dataFeed.base) : '-';
    case 'quote':
      return dataFeed.quote ? showHexValue(dataFeed.quote) : '-';
    case 'chainlink aggregator':
      return dataFeed.chainlink_proxy
        ? showHexValue(dataFeed.chainlink_proxy)
        : '-';
    default:
      return '-';
  }
};

export const DataFeeds = ({
  feeds,
  networks,
  title = 'Select Network :',
  parentTitle,
  titleLevel = 4,
  columns = [
    'id',
    'name',
    'description',
    'report interval',
    'decimals',
    'aggregator',
    'base',
    'quote',
    'chainlink aggregator',
  ],
}: ParametersProps) => {
  const initialFeeds = React.useRef(feeds);
  const initialNetworks = React.useRef(networks);
  const [state, setState] = React.useState({
    selectedValue: '',
    feeds,
  });

  React.useEffect(() => {
    const arrWithDataFeeds = constructDataFeeds(initialNetworks, initialFeeds);
    const newState = {
      ...state,
      feeds: arrWithDataFeeds,
    };
    setState(newState);
  }, []);

  function constructDataFeeds(
    initialNetworks: React.MutableRefObject<Record<string, any>>,
    initialFeeds: React.MutableRefObject<DataFeedModel[]>,
  ): DataFeedModel[] {
    const arrWithDataFeeds: DataFeedModel[] = [];
    Object.keys(initialNetworks.current).forEach((networkId: string) => {
      const chainLinkProxyArr: DataFeedModel[] =
        initialNetworks.current[networkId].contracts.ChainlinkProxy;
      for (let index = 0; index < chainLinkProxyArr.length; index++) {
        const currentDataFeed = initialFeeds.current.find(
          (x: DataFeedModel) =>
            x.description === chainLinkProxyArr[index].description,
        );
        if (currentDataFeed) {
          const constructedDataFeed: DataFeedModel = {
            ...currentDataFeed,
            ...chainLinkProxyArr[index],
          };
          arrWithDataFeeds.push(constructedDataFeed);
        }
      }
    });
    return arrWithDataFeeds;
  }

  function changeNetworkId(networkId: string) {
    if (initialNetworks.current[networkId]) {
      const arrWithDataFeeds: DataFeedModel[] = [];
      const chainLinkProxyArr =
        initialNetworks.current[networkId].contracts.ChainlinkProxy;
      for (let index = 0; index < chainLinkProxyArr.length; index++) {
        const currentDataFeed = initialFeeds.current.find(
          x => x.description === chainLinkProxyArr[index].description,
        );
        if (currentDataFeed) {
          const constructedDataFeed = {
            ...currentDataFeed,
            ...chainLinkProxyArr[index],
          };
          arrWithDataFeeds.push(constructedDataFeed);
        }
      }
      const newState = {
        ...state,
        selectedValue: networkId,
        feeds: arrWithDataFeeds,
      };
      setState(newState);
    } else {
      const newState = {
        ...state,
        selectedValue: networkId,
        feeds: [],
      };
      setState(newState);
    }
  }

  return (
    <ContractItemWrapper
      itemsLength={feeds?.length}
      title={title}
      parentTitle={parentTitle}
      titleLevel={titleLevel}
    >
      <Select
        defaultValue={state.selectedValue}
        onValueChange={changeNetworkId}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All networks" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Supported Networks</SelectLabel>
            <SelectItem value="1">Mainnet ID 1</SelectItem>
            <SelectItem value="11155111">Sepolia ID 11155111</SelectItem>
            <SelectItem value="17000">Holesky ID 17000</SelectItem>
            <SelectItem value="80002">Amoy ID 80002</SelectItem>
            <SelectItem value="3441006">Manta ID 3441006</SelectItem>
            <SelectItem value="43113">Fuji ID 43113</SelectItem>
            <SelectItem value="10200">Chiado ID 10200</SelectItem>
            <SelectItem value="11155420">OpSepolia ID 11155420</SelectItem>
            <SelectItem value="300">zkSyncSepolia ID 300</SelectItem>
            <SelectItem value="84532">BaseSepolia ID 84532</SelectItem>
            <SelectItem value="13527">Specular ID 13527</SelectItem>
            <SelectItem value="534351">ScrollSepolia ID 534351</SelectItem>
            <SelectItem value="421614">ArbSepolia ID 421614</SelectItem>
            <SelectItem value="80085">Artio ID 80085</SelectItem>
            <SelectItem value="167009">Hekla ID 167009</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Table className="variables__table mt-6 mb-4">
        <TableHeader className="variables__table-header">
          <TableRow className="variables__table-header-row">
            {columns.map(column => (
              <TableHead className="variables__table-head" key={column}>
                {columnNames[column]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="variables__table-body">
          {state.feeds?.map((feed: DataFeedModel, index: React.Key) => (
            <TableRow className="variables__table-row" key={index}>
              {columns.map(column => (
                <TableCell
                  className={`variables__table-cell variables__table-cell--${column}`}
                  key={column}
                >
                  {String(getParameterValueByColumn(feed, column))}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ContractItemWrapper>
  );
};
