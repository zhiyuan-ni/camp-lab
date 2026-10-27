export type DiagramProps = {
  steps: string[];
  /** 当前讲到第几步（-1 = 还没开始） */
  activeStep: number;
  /** 旁白进度 0→1 */
  progress: number;
  /** 本段内帧号 */
  frame: number;
  vertical: boolean;
};

export type DiagramDef = {
  component: React.FC<DiagramProps>;
  /** true = 图解自己画步骤，场景不再额外显示步骤列表 */
  ownsSteps?: boolean;
};
