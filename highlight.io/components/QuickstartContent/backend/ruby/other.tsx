import { siteUrl } from '../../../../utils/urls'
import { QuickStartContent } from '../../QuickstartContent'
import { frontendInstallSnippet } from '../shared-snippets'
import {
	customError,
	initializeSdk,
	installSdk,
	setUpLogging,
	verifyErrors,
} from './shared-snippets'

export const RubyOtherContent: QuickStartContent = {
	title: 'Ruby',
	subtitle:
		'Learn how to set up highlight.io on your non-Rails Ruby backend.',
	logoUrl: siteUrl('/images/quickstart/ruby.svg'),
	entries: [
		frontendInstallSnippet,
		installSdk,
		initializeSdk,
		{
			title: 'Add Highlight tracing.',
			content:
				'`trace` will automatically record raised exceptions and send them to Highlight.',
			code: [
				{
					text: `require "highlight"

Highlight::H.instance.trace(nil, nil) do
  # your code here
end`,
					language: 'ruby',
				},
			],
		},
		verifyErrors,
		customError,
		setUpLogging('other'),
	],
}
