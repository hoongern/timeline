import React, { useEffect, useState } from 'react';
import { useCookies } from 'react-cookie';
import './GoogleSheetDataSource.css';

export const sheetSourceCookie = 'sheet-source';

interface DataSource {
	documentId: string;
	sheetNames: string[];
}

interface GoogleSheetData {
	error?: string;
	data?: {
		[x: string]: string;
	};
}

export const useGoogleSheetData = (): [
	GoogleSheetData | undefined,
	({ clearSource }: { clearSource?: boolean }) => void,
] => {
	const [cookies, setCookie] = useCookies([sheetSourceCookie]);
	const source = cookies[sheetSourceCookie] as DataSource;

	const [isFetched, setIsFetched] = useState(false);

	const [sheetData, setSheetData] = useState<GoogleSheetData | undefined>(
		localStorage.getItem('sheetData')
			? JSON.parse(localStorage.getItem('sheetData') as string)
			: { data: undefined },
	);

	const fetchData = React.useCallback(() => {
		if (isFetched || !source || sheetData?.data) {
			return;
		}

		setIsFetched(true);

		const sheetUrls = source.sheetNames.map((sheetName) => {
			return [
				sheetName,
				`https://docs.google.com/spreadsheets/d/${source.documentId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`,
			];
		});

		Promise.all(
			sheetUrls.map(([sheetName, url]) =>
				fetch(url).then((response) => {
					if (!response.ok) {
						if (response.status === 404) {
							throw new Error(
								`The document "${source.documentId}", sheet "${sheetName}" was not found. Please check the IDs, make sure the document is publicly shared, and try again.`,
							);
						} else {
							throw new Error(
								`Failed to fetch Document "${source.documentId}", sheet "${sheetName}". Error ${response.status}: ${response.statusText}`,
							);
						}
					}
					return response.text();
				}),
			),
		)
			.then((responses) => {
				const data = responses.reduce(
					(acc, response, index) => {
						const sheetName = source.sheetNames[index];
						acc[sheetName] = response;
						return acc;
					},
					{} as NonNullable<GoogleSheetData['data']>,
				);

				localStorage.setItem('sheetData', JSON.stringify(data));
				setSheetData({
					data,
				});
			})
			.catch((error) => {
				setSheetData({
					error: error.message,
				});
			});
	}, [source, isFetched, sheetData]);

	const refresh = React.useCallback(
		({ clearSource }: { clearSource?: boolean } = {}) => {
			setIsFetched(false);
			setSheetData(clearSource ? undefined : { data: undefined });
			localStorage.removeItem('sheetData');
			if (clearSource) {
				setCookie(sheetSourceCookie, null);
			} else {
				fetchData();
			}
		},
		[fetchData, setCookie],
	);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	if (!source || !source.documentId || !source.sheetNames) {
		return [undefined, () => {}];
	}

	return [sheetData, refresh];
};

export const Setup: React.FC<{ onCookieSet: () => void; error?: string }> = ({
	onCookieSet,
	error,
}) => {
	const [cookie, setCookie] = useCookies([sheetSourceCookie]);
	const [documentIdValue, setDocumentIdValue] = useState(
		cookie[sheetSourceCookie]?.documentId || '',
	);
	const [sheetNamesValue, setSheetNamesValue] = useState<string[]>(
		cookie[sheetSourceCookie]?.sheetNames || [''],
	);
	const handleDocumentIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setDocumentIdValue(event.target.value);
	};

	const handleSheetNamesChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
		setSheetNamesValue((prev) => {
			const newSheetNames = [...prev];
			newSheetNames[index] = event.target.value;
			return newSheetNames;
		});
	};

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		setCookie(
			sheetSourceCookie,
			JSON.stringify({
				documentId: documentIdValue,
				sheetNames: sheetNamesValue.map((sheetName) => sheetName.trim()),
			} as DataSource),
		);
		onCookieSet();
	};

	return (
		<div className="setupContainer">
			<h1>Timeline</h1>
			{error && <div className="setupError">{error}</div>}
			<form onSubmit={handleSubmit} className="setupForm">
				<div className="setupLabel">
					<label>
						<div>Document ID</div>
						<div className="setupInputContainer">
							<input
								className="setupInput"
								type="text"
								value={documentIdValue}
								onChange={handleDocumentIdChange}
							/>
						</div>
					</label>
				</div>
				<div className="setupLabel">
					<label>
						<div>Sheets</div>
						{sheetNamesValue.map((sheetName, index) => (
							<div className="setupInputContainer" key={index}>
								<input
									className="setupInput"
									type="text"
									value={sheetName}
									onChange={(event) => handleSheetNamesChange(event, index)}
								/>
								{index === sheetNamesValue.length - 1 ? (
									<button
										className="setupInputAddSheet"
										type="button"
										onClick={() => setSheetNamesValue((prev) => [...prev, ''])}
									>
										+
									</button>
								) : (
									<button
										className="setupInputAddSheet"
										type="button"
										onClick={() => setSheetNamesValue((prev) => prev.filter((_, i) => i !== index))}
									>
										-
									</button>
								)}
							</div>
						))}
					</label>
				</div>
				<button
					type="submit"
					className="setupSubmit"
					disabled={!documentIdValue || (sheetNamesValue.length === 1 && !sheetNamesValue[0])}
				>
					Submit
				</button>
			</form>
		</div>
	);
};

// export const SetupGoogleSheet: React.FC<React.PropsWithChildren> = ({ children }) => {
// 	const [cookies] = useCookies([sheetSourceCookie]);

// 	return (
// 		<CookieContext.Provider value={{ cookieValue: cookies[sheetSourceCookie] }}>
// 			{!cookies[sheetSourceCookie] ? (
// 				<Setup
// 					onCookieSet={() => {
// 						window.location.reload();
// 					}}
// 				/>
// 			) : (
// 				children
// 			)}
// 		</CookieContext.Provider>
// 	);
// };
