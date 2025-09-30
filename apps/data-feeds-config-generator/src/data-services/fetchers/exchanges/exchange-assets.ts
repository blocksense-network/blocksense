// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type AssetInfo<ExtraData extends Record<string, unknown> = {}> = {
  pair: {
    base: string;
    quote: string;
  };
  data: ExtraData;
};

export interface ExchangeAssetsFetcher<ExtraData extends Record<string, any>> {
  fetchAssets(): Promise<Array<AssetInfo<ExtraData>>>;
}
