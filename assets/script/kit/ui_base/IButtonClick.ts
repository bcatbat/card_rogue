import { Button } from "cc";


export interface IButtonClick {
    onButtonClickEvent(btn: Button, arg: string): void;
}
