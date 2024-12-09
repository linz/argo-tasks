const resamplingOptions = ['nearest', 'bilinear', 'cubic', 'cubicspline', 'lanczos', 'average', 'mode'] as const;
type ResamplingOption = (typeof resamplingOptions)[number];

export function checkResamplingMethod(resamplingMethod: string): resamplingMethod is ResamplingOption {
  return (resamplingOptions as readonly string[]).includes(resamplingMethod);
}
