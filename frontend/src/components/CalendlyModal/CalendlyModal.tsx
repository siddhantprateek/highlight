import { Button } from '@components/Button'
import * as style from '@components/Modal/ModalV2.css'
import { useGetBillingDetailsForProjectQuery } from '@graph/hooks'
import { Box, IconSolidCalendar, Stack } from '@highlight-run/ui/components'
import { useProjectId } from '@hooks/useProjectId'
import { getAttributionData } from '@util/attribution'
import clsx from 'clsx'
import React, { useState } from 'react'
import { InlineWidget } from 'react-calendly'
import { useHotkeys } from 'react-hotkeys-hook'

import { styledVerticalScrollbar } from '@/style/common.css'

export function Calendly() {
	const { referral } = getAttributionData()
	const utm = JSON.parse(referral)
	console.log({ utm })
	return (
		<InlineWidget
			url="https://calendly.com/highlight-io/discussion"
			styles={{ width: 1080, height: 720 }}
			utm={utm}
		/>
	)
}

export function CalendlyModal() {
	const { projectId } = useProjectId()
	const { data } = useGetBillingDetailsForProjectQuery({
		variables: { project_id: projectId! },
		skip: !projectId,
	})
	const newAccount = data?.workspace_for_project?.trial_end_date
	const [calendlyOpen, setCalendlyOpen] = useState(false)
	useHotkeys(
		'escape',
		() => {
			setCalendlyOpen(false)
		},
		[],
	)

	return (
		<>
			<Button
				kind={newAccount ? 'primary' : 'secondary'}
				size="small"
				emphasis="high"
				onClick={() => setCalendlyOpen(true)}
				trackingId="ClickCalendlyOpen"
				iconLeft={<IconSolidCalendar />}
			>
				Book a call
			</Button>
			{calendlyOpen ? (
				<Box
					display="flex"
					height="screen"
					width="screen"
					position="fixed"
					alignItems="flex-start"
					justifyContent="center"
					style={{
						top: 0,
						left: 0,
						zIndex: '90',
						overflow: 'hidden',
						backgroundColor: '#6F6E777A',
					}}
					onClick={() => setCalendlyOpen(false)}
				>
					<Stack
						cssClass={clsx(
							styledVerticalScrollbar,
							style.modalInner,
						)}
					>
						<Calendly />
					</Stack>
				</Box>
			) : null}
		</>
	)
}
