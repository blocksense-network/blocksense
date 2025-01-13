// @ts-nocheck - TODO(EmilIvanichkov): Temporary ignore typescript errors. Find a better solution.
import React from 'react';
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';

import ArrowRoundedIcon from '@/components/IconComponents/ArrowRoundedIcon';
import ArrowPathIcon from '@/components/IconComponents/ArrowPathIcon';

type Stage = {
  date: string;
  title: string;
  subTitle: string;
  description: string;
};

type RoadMapConfig = Record<string, Stage>;

export const RoadMap = ({ roadMapConfig }: RoadMapConfig) => {
  return (
    <VerticalTimeline className="roadmap shadow-lg" lineColor="#f5f5f5">
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--item"
        contentStyle={{ background: 'rgb(3, 7, 18)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '10px solid  rgb(31, 41, 55)' }}
        date={roadMapConfig['finalStage'].date}
        iconStyle={{
          innerHeight: '40px',
          innerWidth: '40px',
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e6e6e7',
          boxShadow: 'none',
        }}
        icon={<ArrowPathIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-lg font-bold text-white transition">
          {roadMapConfig['finalStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle text-sm font-semibold text-gray-300">
          {roadMapConfig['finalStage'].subTitle}
        </h4>
        <span className="roadmap__timeline-item-description font-normal text-sm italic text-white">
          {roadMapConfig['finalStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--item"
        contentStyle={{ background: 'rgb(3, 7, 18)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['fifthStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e6e6e7',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-lg font-bold text-white transition">
          {roadMapConfig['fifthStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle text-sm font-semibold text-gray-300">
          {roadMapConfig['fifthStage'].subTitle}
        </h4>
        <span className="roadmap__timeline-item-description font-normal text-sm italic text-white">
          {roadMapConfig['fifthStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--item"
        contentStyle={{ background: 'rgb(3, 7, 18)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['fourthStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e6e6e7',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-lg font-bold text-white transition">
          {roadMapConfig['fourthStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle text-sm font-semibold text-gray-300">
          {roadMapConfig['fourthStage'].subTitle}
        </h4>
        <span className="roadmap__timeline-item-description font-normal text-sm italic text-white">
          {roadMapConfig['fourthStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--item"
        contentStyle={{ background: 'rgb(3, 7, 18)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['thirdStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e6e6e7',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-lg font-bold text-white transition">
          {roadMapConfig['thirdStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle text-sm font-semibold text-gray-300">
          {roadMapConfig['thirdStage'].subTitle}
        </h4>
        <span className="roadmap__timeline-item-description font-normal text-sm italic text-white">
          {roadMapConfig['thirdStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--item"
        contentStyle={{ background: 'rgb(3, 7, 18)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['secondStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e6e6e7',
          boxShadow: 'none',
        }}
        icon={<ArrowPathIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-lg font-bold text-white transition">
          {roadMapConfig['secondStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle text-sm font-semibold text-gray-300">
          {roadMapConfig['secondStage'].subTitle}
        </h4>
        <span className="roadmap__timeline-item-description font-normal text-sm italic text-white">
          {roadMapConfig['secondStage'].description}
        </span>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item vertical-timeline-element--item"
        contentStyle={{ background: 'rgb(3, 7, 18)', color: '#fff' }}
        contentArrowStyle={{ borderRight: '7px solid rgb(31, 41, 55)' }}
        date={roadMapConfig['secondStage'].date}
        iconStyle={{
          background: '#fff',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e6e6e7',
          boxShadow: 'none',
        }}
        icon={<ArrowRoundedIcon />}
      >
        <h3 className="roadmap__timeline-item-title vertical-timeline-element-title text-lg font-bold text-white transition">
          {roadMapConfig['firstStage'].title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle vertical-timeline-element-subtitle text-sm font-semibold text-gray-300">
          {roadMapConfig['firstStage'].subTitle}
        </h4>
        <span className="roadmap__timeline-item-description font-normal text-sm italic text-white">
          {roadMapConfig['firstStage'].description}
        </span>
      </VerticalTimelineElement>
    </VerticalTimeline>
  );
};
