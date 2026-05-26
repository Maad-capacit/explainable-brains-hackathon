declare module "plotly.js-gl3d-dist-min" {
  interface PlotlyHTMLElement extends HTMLElement {
    on(event: string, handler: (ev: PlotMouseEvent) => void): PlotlyHTMLElement;
    removeAllListeners(event: string): PlotlyHTMLElement;
  }

  interface PlotMouseEvent {
    points: Array<{
      x: number;
      y: number;
      z: number;
      pointIndex: number;
      pointNumber?: number;
      curveNumber: number;
      data: { customdata?: unknown[] };
      customdata?: unknown;
    }>;
  }

  function react(
    root: HTMLElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<PlotlyHTMLElement>;

  function restyle(
    root: HTMLElement,
    update: Record<string, unknown>,
    traceIndices?: number | number[],
  ): Promise<PlotlyHTMLElement>;

  function purge(root: HTMLElement): void;

  function relayout(root: HTMLElement, update: Record<string, unknown>): Promise<PlotlyHTMLElement>;

  function Plots(): void;

  const _default: {
    react: typeof react;
    restyle: typeof restyle;
    purge: typeof purge;
    relayout: typeof relayout;
  };

  export { react, restyle, purge, relayout };
  export default _default;
}
