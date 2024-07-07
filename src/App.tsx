import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { useGoogleSheetData, SetupGoogleSheet } from './GoogleSheetDataSource';
import { CSVToArray } from './csv';
import { useDrag, useGesture } from '@use-gesture/react';

interface Event {
	title: string;
	start: Date;
	end?: Date;
	color?: string;
}

interface EventCollection {
	events: Event[];
	title: string;
}

interface TimelineExtent {
	start: Date;
	end: Date;
}

interface PositionEventCollection {
	positionedEvents: PositionedEvent[];
	title: string;
}

interface PositionedEvent {
	left: number;
	eventWidth: number;
	displayWidth: number;
	height: number;
	top: number;
	event: Event;
	lane: number;
}

const font = '16px Georgia';
const dotSize = 20;
const textPadding = 4;

function Timeline({
	collection,
	refreshData,
}: {
	collection: EventCollection[];
	refreshData: () => void;
}) {
	const [extent, setExtent] = useState(calculateExtent(collection));
	const [eventPositions, setEventPositions] = useState<PositionEventCollection[]>([]);
	const [dragging, setDragging] = useState(false);
	const container = useRef<HTMLDivElement>(null);

	const canvasContext = useMemo(() => {
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) {
			throw new Error('Could not get 2d context');
		}
		context.font = font;
		return context;
	}, []);

	// Rerender when the window is resized
	useLayoutEffect(() => {
		function layout() {
			const width = container.current?.offsetWidth;
			const height = container.current?.offsetHeight;

			if (!width || !height) {
				return;
			}

			const scale = width / (extent.end.getTime() - extent.start.getTime());

			const positionedEventCollections: PositionEventCollection[] = [];

			for (const { events, title } of collection) {
				const positionedEvents: PositionedEvent[] = [];
				for (const event of events) {
					const left = (event.start.getTime() - extent.start.getTime()) * scale - dotSize / 2 + 1;
					const eventWidth =
						((event.end ?? event.start).getTime() - event.start.getTime()) * scale +
						dotSize / 2 -
						1;

					const textSize = canvasContext.measureText(event.title);

					const displayWidth = Math.max(dotSize, eventWidth) + textSize.width + 2 * textPadding;

					// Find lanes which contained colored events
					const coloredLanes = new Set(
						positionedEvents.filter((x) => x.event.color).map((x) => x.lane),
					);

					const nextNonColoredLane = Array.from({ length: coloredLanes.size + 1 }).find(
						(_, i) => !coloredLanes.has(i),
					) as number;

					let lane =
						positionedEvents.find((x) => x.event.color === event.color)?.lane ??
						nextNonColoredLane ??
						0;
					while (
						positionedEvents.some(
							// eslint-disable-next-line no-loop-func
							(p) =>
								p.lane === lane && p.left < left + displayWidth && p.left + p.displayWidth > left,
						)
					) {
						lane++;
					}

					positionedEvents.push({
						left,
						displayWidth,
						eventWidth: Math.max(dotSize, eventWidth),
						height: dotSize,
						top: lane * (dotSize + textPadding * 2),
						event,
						lane,
					});
				}

				positionedEventCollections.push({ positionedEvents, title });
			}

			setEventPositions(positionedEventCollections);
		}

		if (!container.current) {
			return;
		}

		// Add a resize observer on the container
		const observer = new ResizeObserver(layout);
		observer.observe(container.current!);
		layout();

		return () => {
			observer.disconnect();
		};
	}, [extent.end, extent.start, canvasContext, collection]);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			const delta = e.deltaY;
			const scale = 1 + delta / 1000;
			const center = e.clientX / container.current!.offsetWidth;
			const newStart = new Date(
				extent.start.getTime() -
					(extent.end.getTime() - extent.start.getTime()) * center * (scale - 1),
			);
			const newEnd = new Date(
				extent.end.getTime() +
					(extent.end.getTime() - extent.start.getTime()) * (1 - center) * (scale - 1),
			);
			setExtent({ start: newStart, end: newEnd });
		},
		[extent.end, extent.start],
	);

	const handleMouseDown = useCallback(() => {
		setDragging(true);
	}, []);

	const handleMouseUp = useCallback(() => {
		setDragging(false);
	}, []);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			if (dragging) {
				const delta = e.movementX;
				const scale =
					container.current!.offsetWidth / (extent.end.getTime() - extent.start.getTime());
				const newStart = new Date(extent.start.getTime() - delta / scale);
				const newEnd = new Date(extent.end.getTime() - delta / scale);
				setExtent({ start: newStart, end: newEnd });
			}
		},
		[dragging, extent.end, extent.start],
	);

	const bind = useGesture(
		{
			onDrag: (state) => {
				if (!state.down) {
					return;
				}
				const delta = state.delta[0];
				const scale =
					container.current!.offsetWidth / (extent.end.getTime() - extent.start.getTime());
				const newStart = new Date(extent.start.getTime() - delta / scale);
				const newEnd = new Date(extent.end.getTime() - delta / scale);
				setExtent({ start: newStart, end: newEnd });
			},
		},
		{ drag: {} },
	);

	const todayLeft =
		((new Date().getTime() - extent.start.getTime()) /
			(extent.end.getTime() - extent.start.getTime())) *
		100;

	return (
		<div
			className="timelineContainer"
			ref={container}
			onWheel={handleWheel}
			onMouseDown={handleMouseDown}
			onMouseUp={handleMouseUp}
			onMouseMove={handleMouseMove}
			style={{
				cursor: dragging ? 'grabbing' : 'grab',
			}}
			{...bind()}
		>
			{Array.from({ length: extent.end.getFullYear() - extent.start.getFullYear() + 2 }).map(
				(_, i) => {
					const year = extent.start.getFullYear() + i;
					const left =
						((new Date(year, 0, 1).getTime() - extent.start.getTime()) /
							(extent.end.getTime() - extent.start.getTime())) *
						100;
					return (
						<div
							key={year}
							className="yearMarker"
							style={{
								left: `${left}%`,
								width: `${100 / (extent.end.getFullYear() - extent.start.getFullYear() + 1)}%`,
							}}
						>
							<div className="yearLabel">{year}</div>
						</div>
					);
				},
			)}

			<div
				className="todayMarker"
				style={{
					left: `${todayLeft}%`,
				}}
			/>
			{eventPositions.map((collection, i) => (
				<div
					key={collection.title}
					style={{ position: 'relative', top: `${(i / eventPositions.length) * 100}%` }}
				>
					<div className="eventCollectionBar" />
					<div className="eventCollectionTitle">{collection.title}</div>
					<div className="eventsContainer">
						{collection.positionedEvents.map(
							({ left, eventWidth, displayWidth, height, top, event }) => (
								<div
									key={event.title + event.start.toISOString()}
									style={{
										position: 'absolute',
										left,
										width: displayWidth,
										height,
										top,
									}}
								>
									{event.end ? (
										<div
											className="eventBar"
											style={{
												position: 'absolute',
												left: 0,
												width: eventWidth,
												height,
												top: 0,
												backgroundColor: event.end ? event.color || 'white' : undefined,
												borderRadius: dotSize,
												boxShadow: event.end ? '0 0 0 1px gray' : undefined,
											}}
										/>
									) : null}
									<div
										title={
											`${event.start.toDateString()}` +
											(event.end
												? ` - ${event.end.toDateString()} (${calculateDays(event.start, event.end)})`
												: '')
										}
										className="eventDot"
										style={{
											width: dotSize,
											height: dotSize,
											backgroundColor: event.end ? 'black' : event.color || 'black',
										}}
									/>
									<span
										className="eventTitle"
										style={{
											font,
											left: dotSize + textPadding,
										}}
									>
										{event.title}
									</span>
								</div>
							),
						)}
					</div>
				</div>
			))}
			<button className="refreshButton" onClick={refreshData}>
				Refresh
			</button>
		</div>
	);
}

function calculateDays(start: Date, end: Date) {
	return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateExtent(collection: EventCollection[]): TimelineExtent {
	const events = collection.flatMap((c) => c.events);
	const extent = events.reduce(
		(acc, { start, end }) => {
			end = end || start;
			return {
				start: start < acc.start ? start : acc.start,
				end: end > acc.end ? end : acc.end,
			};
		},
		{ start: events[0].start, end: events[0].start },
	);

	if (extent.end.getFullYear() - extent.start.getFullYear() > 20) {
		extent.end = new Date(extent.start.getFullYear() + 20, 0, 1);
	}

	return extent;
}

function TimelineProvider() {
	const [googleSheet, refreshGoogleSheet] = useGoogleSheetData();

	const collections: EventCollection[] | undefined = React.useMemo(
		() =>
			googleSheet &&
			Object.entries(googleSheet).map(([title, data]) => {
				const events = CSVToArray(data).map((parts) => {
					const [start, end, color, title] = parts;

					// Check if start is a valid date
					if (isNaN(new Date(start).getTime())) {
						return null;
					}

					return {
						title,
						start: new Date(start),
						end: end
							? new Date(end).getFullYear() > 3000
								? new Date()
								: new Date(end)
							: undefined,
						color,
					};
				});

				return { title, events: events.filter((x) => x) as Event[] };
			}),
		[googleSheet],
	);

	if (!collections) {
		return <div>Loading...</div>;
	}

	return <Timeline collection={collections} refreshData={refreshGoogleSheet} />;
}

function App() {
	return (
		<div className="App">
			<SetupGoogleSheet>
				<TimelineProvider />
			</SetupGoogleSheet>
		</div>
	);
}

export default App;
