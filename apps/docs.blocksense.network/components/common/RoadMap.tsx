import React from 'react';
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import ArrowRoundedIcon from '../IconComponents/ArrowRoundedIcon';
import ArrowPathIcon from '../IconComponents/ArrowPathIcon';

export type Stage = {
  date: string;
  title: string;
  subTitle: string;
  description: string;
};

export type RoadMapConfig = Record<string, Stage>;

export const RoadMap = ({ roadMapConfig }: RoadMapConfig) => {
  return (
    <VerticalTimeline className="roadmap bg-gray-100">
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--work"
        contentStyle={{ background: 'rgb(31, 41, 55)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '10px solid  rgb(31, 41, 55)' }}
        date={roadMapConfig['finalStage'].date}
        iconStyle={{
          innerHeight: '70px',
          innerWidth: '70px',
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
        }}
        icon={<ArrowPathIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-xl font-bold text-white transition">
          {roadMapConfig['finalStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle font-semibold text-gray-300">
          {roadMapConfig['finalStage'].subTitle}
        </h4>
        <span className="mt-6 font-normal text-white tracking-tight">
          {roadMapConfig['finalStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--work"
        contentStyle={{ background: 'rgb(31, 41, 55)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid  rgb(31, 41, 55)' }}
        date={roadMapConfig['fifthStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-xl font-bold text-white transition">
          {roadMapConfig['fifthStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle font-semibold text-gray-300">
          {roadMapConfig['fifthStage'].subTitle}
        </h4>
        <span className="mt-6 font-normal text-white tracking-tight">
          {roadMapConfig['fifthStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--work"
        contentStyle={{ background: 'rgb(31, 41, 55)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['fourthStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
        }}
        icon={<ArrowPathIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-xl font-bold text-white transition">
          {roadMapConfig['fourthStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle font-semibold text-gray-300">
          {roadMapConfig['fourthStage'].subTitle}
        </h4>
        <span className="mt-6 font-normal text-white tracking-tight">
          {roadMapConfig['fourthStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--work"
        contentStyle={{ background: 'rgb(31, 41, 55)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['thirdStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-xl font-bold text-white transition">
          {roadMapConfig['thirdStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle font-semibold text-gray-300">
          {roadMapConfig['thirdStage'].subTitle}
        </h4>
        <span className="mt-6 font-normal text-white tracking-tight">
          {roadMapConfig['thirdStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--work"
        contentStyle={{ background: 'rgb(31, 41, 55)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['secondStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
        }}
        icon={<ArrowPathIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-xl font-bold text-white transition">
          {roadMapConfig['secondStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle font-semibold text-gray-300">
          {roadMapConfig['secondStage'].subTitle}
        </h4>
        <span className="mt-6 font-normal text-white tracking-tight">
          {roadMapConfig['secondStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--work"
        contentStyle={{ background: 'rgb(31, 41, 55)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['secondStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e5e7eb',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-xl font-bold text-white transition">
          {roadMapConfig['firstStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle font-semibold text-gray-300">
          {roadMapConfig['firstStage'].subTitle}
        </h4>
        <span className="mt-6 font-normal text-white tracking-tight">
          {roadMapConfig['firstStage'].description}
        </span>
      </VerticalTimelineElement>
    </VerticalTimeline>
  );
};
