import {
  Box,
  type BoxProps,
  type ElementProps,
  type Factory,
  type StylesApiProps,
  createVarsResolver,
  factory,
  useProps,
  useStyles,
} from "@mantine/core";
import type { ScheduleLabelsOverride } from "../../labels";
import {
  HeaderControl,
  type HeaderControlStylesNames,
  ScheduleHeaderNext,
  ScheduleHeaderPrevious,
  ScheduleHeaderToday,
} from "./HeaderControl/HeaderControl";
import {
  MonthYearSelect,
  type MonthYearSelectStylesNames,
} from "./MonthYearSelect/MonthYearSelect";
import classes from "./ScheduleHeader.module.css";
import { ScheduleHeaderLabelsContext } from "./ScheduleHeaderContext";
import { ViewSelect, type ViewSelectStylesNames } from "./ViewSelect/ViewSelect";

export type CombinedScheduleHeaderStylesNames =
  | ScheduleHeaderStylesNames
  | ViewSelectStylesNames
  | HeaderControlStylesNames
  | MonthYearSelectStylesNames;

type ScheduleHeaderStylesNames = "header";
type ScheduleHeaderCssVariables = {
  scheduleHeader: "--test";
};

interface ScheduleHeaderProps
  extends BoxProps,
    StylesApiProps<ScheduleHeaderFactory>,
    ElementProps<"div"> {
  __staticSelector?: string;

  /** Labels override shared with compound components rendered inside */
  labels?: ScheduleLabelsOverride;
}

export type ScheduleHeaderFactory = Factory<{
  props: ScheduleHeaderProps;
  ref: HTMLDivElement;
  stylesNames: ScheduleHeaderStylesNames;
  vars: ScheduleHeaderCssVariables;
  staticComponents: {
    Control: typeof HeaderControl;
    Previous: typeof ScheduleHeaderPrevious;
    Next: typeof ScheduleHeaderNext;
    Today: typeof ScheduleHeaderToday;
    ViewSelect: typeof ViewSelect;
    MonthYearSelect: typeof MonthYearSelect;
  };
}>;

const defaultProps = {
  __staticSelector: "ScheduleHeader",
} satisfies Partial<ScheduleHeaderProps>;

const varsResolver = createVarsResolver<ScheduleHeaderFactory>(() => ({
  scheduleHeader: {
    "--test": "test",
  },
}));

export const ScheduleHeader = factory<ScheduleHeaderFactory>((_props) => {
  const props = useProps("ScheduleHeader", defaultProps, _props);
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    __staticSelector,
    labels,
    ...others
  } = props;

  const getStyles = useStyles<ScheduleHeaderFactory>({
    name: __staticSelector,
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    vars,
    varsResolver,
    attributes,
    rootSelector: "header",
  });

  return (
    <ScheduleHeaderLabelsContext.Provider value={labels}>
      <Box {...getStyles("header")} {...others} />
    </ScheduleHeaderLabelsContext.Provider>
  );
});

ScheduleHeader.displayName = "@/lib/vendored/mantine-schedule/ScheduleHeader";
ScheduleHeader.classes = classes;
ScheduleHeader.varsResolver = varsResolver;
ScheduleHeader.Control = HeaderControl;
ScheduleHeader.Next = ScheduleHeaderNext;
ScheduleHeader.Previous = ScheduleHeaderPrevious;
ScheduleHeader.Today = ScheduleHeaderToday;
ScheduleHeader.ViewSelect = ViewSelect;
ScheduleHeader.MonthYearSelect = MonthYearSelect;
