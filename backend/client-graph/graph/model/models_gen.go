// Code generated by github.com/99designs/gqlgen, DO NOT EDIT.

package model

type ErrorObjectInput struct {
	Event        string             `json:"event"`
	Type         string             `json:"type"`
	Source       string             `json:"source"`
	LineNumber   int                `json:"lineNumber"`
	ColumnNumber int                `json:"columnNumber"`
	Trace        []*StackFrameInput `json:"trace"`
}

type StackFrameInput struct {
	ColumnNumber *int    `json:"columnNumber"`
	LineNumber   *int    `json:"lineNumber"`
	FileName     *string `json:"fileName"`
	FunctionName *string `json:"functionName"`
}
