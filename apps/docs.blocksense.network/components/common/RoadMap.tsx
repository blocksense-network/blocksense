import React from 'react';
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from 'react-vertical-timeline-component';
import 'react-vertical-timeline-component/style.min.css';
import CubeIcon from '../IconComponents/Cube';
import BlockIcon from '../IconComponents/Block';
import { roadMapConfig } from '../../config';

export const RoadMap = () => {
  return (
    <VerticalTimeline className="roadmap">
      <VerticalTimelineElement
        className="roadmap__timeline-item"
        date={roadMapConfig.finalStage.date}
        iconStyle={{ background: 'rgb(233, 30, 99)', color: '#fff' }}
        icon={<BlockIcon />}
      >
        <h3 className="roadmap__timeline-item-title">
          {roadMapConfig.finalStage.title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle">
          {roadMapConfig.finalStage.subTitle}
        </h4>
        <p>{roadMapConfig.finalStage.description}</p>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item"
        date={roadMapConfig.fifthStage.date}
        iconStyle={{ background: 'rgb(233, 30, 99)', color: '#fff' }}
        icon={<BlockIcon />}
      >
        <h3 className="roadmap__timeline-item-title">
          {roadMapConfig.fifthStage.title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle">
          {roadMapConfig.fifthStage.subTitle}
        </h4>
        <p>{roadMapConfig.fifthStage.description}</p>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item"
        date={roadMapConfig.fourthStage.date}
        iconStyle={{ background: 'rgb(233, 30, 99)', color: '#fff' }}
        icon={<BlockIcon />}
      >
        <h3 className="roadmap__timeline-item-title">
          {roadMapConfig.fourthStage.title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle">
          {roadMapConfig.fourthStage.subTitle}
        </h4>
        <p>{roadMapConfig.fourthStage.description}</p>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item"
        date={roadMapConfig.thirdStage.date}
        iconStyle={{ background: 'rgb(233, 30, 99)', color: '#fff' }}
        icon={<BlockIcon />}
      >
        <h3 className="roadmap__timeline-item-title">
          {roadMapConfig.thirdStage.title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle">
          {roadMapConfig.thirdStage.subTitle}
        </h4>
        <p>{roadMapConfig.thirdStage.description}</p>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item"
        date={roadMapConfig.secondStage.date}
        iconStyle={{ background: 'rgb(233, 30, 99)', color: '#fff' }}
        icon={<BlockIcon />}
      >
        <h3 className="roadmap__timeline-item-title">
          {roadMapConfig.secondStage.title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle">
          {roadMapConfig.secondStage.subTitle}
        </h4>
        <p>{roadMapConfig.secondStage.description}</p>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        className="roadmap__timeline-item"
        date={roadMapConfig.secondStage.date}
        iconStyle={{ background: 'rgb(233, 30, 99)', color: '#fff' }}
        icon={<BlockIcon />}
      >
        <h3 className="roadmap__timeline-item-title">
          {roadMapConfig.firstStage.title}
        </h3>
        <h4 className="roadmap__timeline-item-subtitle">
          {roadMapConfig.firstStage.subTitle}
        </h4>
        <p>{roadMapConfig.firstStage.description}</p>
      </VerticalTimelineElement>
      <VerticalTimelineElement
        iconStyle={{ background: 'rgb(16, 204, 82)', color: '#fff' }}
        icon={<CubeIcon />}
      />
    </VerticalTimeline>
  );
};
