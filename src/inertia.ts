import { useCallback, useRef, useState } from 'react';

export function useInertia(
	callback: (delta: number) => void,
): [(velocity: number) => void, () => void] {
	const [, setVelocity] = useState(0);

	const intervalId = useRef<number | null>(null);

	const beginInertia = useCallback(
		(initialVelocity: number) => {
			setVelocity(initialVelocity);

			intervalId.current = window.setInterval(() => {
				setVelocity((velocity) => {
					callback(velocity);
					if (Math.abs(velocity) < 0.1) {
						clearInterval(intervalId.current!);
						intervalId.current = null;
						return 0;
					}

					return velocity * 0.95;
				});
			}, 1000 / 60);
		},
		[callback],
	);

	const endInertia = useCallback(() => {
		if (intervalId.current !== null) {
			clearInterval(intervalId.current);
			intervalId.current = null;
		}
	}, []);

	return [beginInertia, endInertia];
}
